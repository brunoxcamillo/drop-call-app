// src/services/zapiService.js
import axios from "axios";
import { updateOrder } from "./orderService.js";
import { orderStatusTypes } from "../utils/supabaseClient.js";
import { formatMessage } from "../utils/messageFormatter.js";
import { getMessageByType } from "./messageService.js";

/* ===========================
   ENV + Cliente axios
=========================== */
const requiredEnv = ["ZAPI_URL", "ZAPI_INSTANCE", "ZAPI_TOKEN", "ZAPI_ACCOUNT_TOKEN"];
for (const k of requiredEnv) {
  if (!process.env[k]) {
    // Não lançamos erro na importação para não quebrar o app em dev,
    // mas deixamos claro no log.
    console.warn(`[zapiService] Missing env var: ${k}`);
  }
}

const baseURL = `${process.env.ZAPI_URL}/instances/${process.env.ZAPI_INSTANCE}/token/${process.env.ZAPI_TOKEN}`.replace(/\/+$/, "");
export const zapi = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    "client-token": process.env.ZAPI_ACCOUNT_TOKEN || "",
  },
});

/* ===========================
   Helpers
=========================== */
function normalizePhone(phone) {
  if (!phone) return null;
  // Z-API costuma aceitar dígitos sem "+" em E.164
  const digits = String(phone).replace(/\D/g, "");
  return digits.length ? digits : null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const shouldRetry = (err) => {
  const status = err?.response?.status;
  // Re-tentamos em 429/5xx e erros de rede/timeouts
  return !status || status === 429 || (status >= 500 && status < 600);
};

async function postWithRetry(url, payload, { attempts = 3, baseDelay = 500 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await zapi.post(url, payload);
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1 && shouldRetry(err)) {
        const delay = baseDelay * 2 ** i;
        await sleep(delay);
        continue;
      }
      break;
    }
  }
  throw lastErr;
}

/* ===========================
   Envio genérico
=========================== */
export async function sendWhatsAppMessage(phone, message) {
  try {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      throw new Error(`Telefone inválido: "${phone}"`);
    }
    if (!message || !String(message).trim()) {
      throw new Error("Mensagem vazia/indefinida.");
    }

    const payload = { phone: normalized, message };
    const { data } = await postWithRetry("/send-messages", payload, {
      attempts: 3,
      baseDelay: 600,
    });

    console.log("✅ Mensagem enviada via Z-API:", {
      to: normalized,
      zapiRequestId: data?.requestId || data?.id || undefined,
      status: data?.status || "unknown",
    });

    return data;
  } catch (error) {
    const res = error?.response;
    console.error(
      "❌ Erro ao enviar WhatsApp:",
      res?.data || { message: error.message }
    );
    throw error;
  }
}

/* ===========================
   Confirmação inicial (Shopify)
   - order: objeto da sua tabela "orders"
   - store: objeto da sua tabela "stores"
   - opts.overridePhone: usar número de teste sem mexer no código
=========================== */
export async function sendWhatsAppConfirmation(order, store, opts = {}) {
  const phone = opts.overridePhone || order?.customer_phone;
  const normalized = normalizePhone(phone);

  if (!normalized) {
    throw new Error(`Telefone inválido para confirmação (order ${order?.id}): "${phone}"`);
  }

  const message = await formatMessage(order, store); // sua mensagem personalizada
  await sendWhatsAppMessage(normalized, message);

  // Atualiza status somente após envio OK
  return updateOrder(order.id, { status: orderStatusTypes.pending_confirmation });
}

/* ===========================
   Enviar por "tipo" (templates)
=========================== */
export async function sendWhatsAppMessageByType(phone, type, countryCode, vars = {}) {
  const normalized = normalizePhone(phone);
  if (!normalized) throw new Error(`Telefone inválido: "${phone}"`);

  const cc = (countryCode || "BR").toUpperCase();

  const dataMessage = await getMessageByType(type, cc);
  const record = Array.isArray(dataMessage) ? dataMessage[0] : dataMessage;

  if (!record || !record.message) {
    throw new Error(`Mensagem de tipo "${type}" não encontrada para país "${cc}".`);
  }

  // interpolação simples: {{key}}
  let text = String(record.message);
  text = text.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars?.[k] ?? ""));

  return sendWhatsAppMessage(normalized, text);
}
