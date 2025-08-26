// src/queue.js
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";

import { sendWhatsAppConfirmation, sendWhatsAppMessageByType, sendWhatsAppMessage } from "./services/zapiService.js";
import { getOrderById, updateOrder } from "./services/orderService.js";
import { messageTypes, orderStatusTypes } from "./utils/supabaseClient.js";
import logger from "./utils/logger.js";
import { getStoreById } from "./services/storeService.js";

const connection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
});

// Fila principal
export const queue = new Queue("main", {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 500,
        removeOnFail: 100,
    },
});

// Worker
const worker = new Worker(
    "main",
    async (job) => {
        const { type, payload } = job.data;

        // Envio da confirmação inicial (mantido)
        if (type === "send_whatsapp_confirmation") {
            const order = await getOrderById(payload.orderId);
            const store = await getStoreById(payload.storeId);
            logger.info(`📲 enviando confirmação do pedido: ${order.shopify_id}`);
            await sendWhatsAppConfirmation(order, store);
            return { ok: true };
        }

        // NOVO: render + envio das mensagens decididas pelo FSM
        if (type === "send_dialog_messages") {
            const { storeId, phone, cc, orderId, messages, context } = payload;
            const order = await getOrderById(orderId);

            for (const m of messages) {
                if (m.type === "template") {
                    await sendWhatsAppMessageByType(
                        order.customer_phone,
                        m.key,
                        cc,
                        m.vars || {}   // <<< passa variáveis do template
                    );
                } else if (m.type === "text") {
                    // opcionalmente, elimine "text" do FSM para 100% templated
                    await sendWhatsAppMessage(order.customer_phone, m.text);
                }

            }

            // Efeitos colaterais finais (status do pedido) após envio OK
            if (context?.order_status === "confirmed") {
                await updateOrder(order.id, { status: orderStatusTypes.confirmed });
            } else if (context?.order_status === "canceled") {
                await updateOrder(order.id, { status: orderStatusTypes.canceled });
            } else if (context?.order_status === "address_change") {
                await updateOrder(order.id, { status: orderStatusTypes.address_change });
            }

            return { ok: true };
        }

        // ======== Legado (mantido por compatibilidade, pode remover depois) ========
        if (type === "classify_message") {
            logger.warn("Deprecated: 'classify_message' – fluxo agora é FSM. Ignorando.");
            return { ok: true };
        }

        if (type === "address_change") {
            // No novo fluxo, quem pede/revisa endereço é o FSM.
            // Mantemos resposta curta para não quebrar jobs antigos.
            const order = await getOrderById(payload.orderId);
            await sendWhatsAppMessageByType(order.customer_phone, messageTypes.on_change_address_response, payload.cc);
            logger.info(`📦 Confirmação de endereço recebida (legado) para pedido: ${order.shopify_id}`);
            return { ok: true };
        }

        throw new Error(`Tipo desconhecido: ${type}`);
    },
    { connection }
);

worker.on("completed", (job) => logger.info(`✅ job ${job.id} concluído`));
worker.on("failed", (job, err) => logger.error(`❌ job ${job.id} falhou`, err.message));
