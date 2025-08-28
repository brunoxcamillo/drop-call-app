// src/queue.js
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { syncShopifyOrderTags } from "./services/shopifyTagSyncService.js";
import {
    sendWhatsAppConfirmation,
    sendWhatsAppMessageByType,
    sendWhatsAppMessage,
} from "./services/zapiService.js";
import { getOrderById, updateOrder } from "./services/orderService.js";
import { messageTypes, orderStatusTypes } from "./utils/supabaseClient.js";
import logger from "./utils/logger.js";
import { getStoreById } from "./services/storeService.js";

// ---------- Redis connection (TLS-ready, robust) ----------
syncShopifyOrderTags({order_id: 84, store_id: 1});
const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
    throw new Error("Faltou REDIS_URL nas variáveis de ambiente.");
}

const useTLS = REDIS_URL.startsWith("rediss://");

const connection = new IORedis(REDIS_URL, {
    // Cloud Redis: boas práticas para BullMQ
    tls: useTLS ? {} : undefined,   // ativa TLS somente se rediss://
    lazyConnect: true,              // conecta quando for usar
    maxRetriesPerRequest: null,     // evita erros com comandos bloqueantes
    enableReadyCheck: true,
    connectTimeout: 10_000,
    retryStrategy: (times) => Math.min(200 * times, 5_000),
    reconnectOnError: (err) =>
        /READONLY|ETIMEDOUT|ECONNRESET|EAI_AGAIN/i.test(err.message),
});

connection.on("connect", () => logger.info("🔌 Redis conectando..."));
connection.on("ready", () => logger.info("✅ Redis pronto"));
connection.on("error", (e) => logger.error("❌ Redis error", e));
connection.on("close", () => logger.warn("🔒 Redis conexão fechada"));
connection.on("reconnecting", () => logger.warn("♻️ Redis reconectando..."));

// ---------- Queue / Worker ----------
const prefix = process.env.QUEUE_PREFIX || "qprod";
const workerConcurrency = Number(process.env.WORKER_CONCURRENCY || 5);

// Fila principal
export const queue = new Queue("main", {
    connection,
    prefix,
    defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 500,
        removeOnFail: 200,
    },
});

// Worker
const worker = new Worker(
    "main",
    async (job) => {
        console.log("⚙️ worker carregado!");
        const { type, payload } = job.data;

        // 1) Envio da confirmação inicial (mantido)
        if (type === "send_whatsapp_confirmation") {
            const order = await getOrderById(payload.orderId);
            const store = await getStoreById(payload.storeId);
            logger.info(`📲 enviando confirmação do pedido: ${order.shopify_id}`);
            await sendWhatsAppConfirmation(order, store);
            return { ok: true };
        }

        // 2) Mensagens decididas pelo FSM (templates + vars)
        if (type === "send_dialog_messages") {
            const { cc, orderId, messages, context } = payload;
            const order = await getOrderById(orderId);

            if (Array.isArray(messages)) {
                for (const m of messages) {
                    if (m.type === "template") {
                        await sendWhatsAppMessageByType(
                            order.customer_phone,
                            m.key,
                            cc,
                            m.vars || {}
                        );
                    } else if (m.type === "text") {
                        // Se quiser 100% via template, remova este branch
                        await sendWhatsAppMessage(order.customer_phone, m.text);
                    }
                }
            }

            // 3) Efeitos colaterais finais (status do pedido) após envio OK
            if (context?.order_status === "confirmed") {
                await updateOrder(order.id, { status: orderStatusTypes.confirmed });
                await syncShopifyOrderTags({ order_id: order.id, store_id: store.id });

            } else if (context?.order_status === "canceled") {
                await updateOrder(order.id, { status: orderStatusTypes.canceled });

            } else if (context?.order_status === "address_change") {
                await updateOrder(order.id, { status: orderStatusTypes.address_change });
                await syncShopifyOrderTags({ order_id: order.id, store_id: store.id });

            }

            return { ok: true };
        }

        throw new Error(`Tipo desconhecido: ${type}`);
    },
    {
        connection,
        prefix,
        concurrency: workerConcurrency,
    }
);

// Eventos do worker
worker.on("completed", (job) =>
    logger.info(`✅ job ${job.id} concluído`)
);
worker.on("failed", (job, err) =>
    logger.error(`❌ job ${job?.id} falhou`, err?.stack || err?.message)
);

// ---------- Healthcheck / Shutdown gracioso ----------
export async function pingRedis() {
    try {
        await connection.ping();
        return true;
    } catch {
        return false;
    }
}

async function shutdown(name, code) {
    try {
        logger.warn(`🛑 Recebi ${name}, encerrando worker/redis...`);
        await worker.close();   // para de pegar jobs
        await queue.close();    // fecha conexão da fila
        await connection.quit();
        logger.warn("👋 Encerrado com segurança.");
        // eslint-disable-next-line no-process-exit
        process.exit(code);
    } catch (e) {
        logger.error("Erro ao encerrar:", e);
        // eslint-disable-next-line no-process-exit
        process.exit(1);
    }
}

process.on("SIGTERM", () => shutdown("SIGTERM", 0));
process.on("SIGINT", () => shutdown("SIGINT", 0));

