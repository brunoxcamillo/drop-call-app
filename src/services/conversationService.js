// src/services/conversationService.js
import { supabase } from "../utils/supabaseClient.js";

/**
 * Regra: apenas 1 conversa ABERTA por (store_id, phone).
 * - Se existir aberta, retorna ela (e opcionalmente atualiza o order_id).
 * - Se não existir, cria uma nova.
 */
export async function loadOrCreateSession({ store_id, phone, order_id, locale = "pt" }) {
    // Busca conversa ABERTA (is_closed=false) por store+phone
    const { data: existing, error: qErr } = await supabase
        .from("conversations")
        .select("*")
        .eq("store_id", store_id)
        .eq("phone", phone)
        .eq("is_closed", false)
        .maybeSingle();

    if (qErr) throw qErr;

    if (existing) {
        // Se quiser “carimbar” o último order_id visto nesta sessão:
        if (order_id && existing.order_id !== order_id) {
            await supabase
                .from("conversations")
                .update({ order_id, updated_at: new Date().toISOString() })
                .eq("id", existing.id);
            existing.order_id = order_id;
        }
        return existing;
    }

    // Não existe aberta → cria
    const { data: created, error: cErr } = await supabase
        .from("conversations")
        .insert([{
            store_id,
            phone,
            order_id: order_id ?? null,
            state: "start",
            context: {},
            history: [],
            locale,
            is_closed: false
        }])
        .select()
        .single();

    if (cErr) throw cErr;
    return created;
}

export async function saveSession(id, state, context, history, is_closed = false) {
    const { error } = await supabase
        .from("conversations")
        .update({
            state,
            context,
            history,
            is_closed,
            updated_at: new Date().toISOString()
        })
        .eq("id", id);
    if (error) throw error;
}

export async function closeSession(id) {
    const { error } = await supabase
        .from("conversations")
        .update({ is_closed: true, updated_at: new Date().toISOString() })
        .eq("id", id);
    if (error) throw error;
}


export async function closeOpenSessionsForPhone({ store_id, phone }) {
  const { error } = await supabase
    .from("conversations")
    .update({ is_closed: true, updated_at: new Date().toISOString() })
    .eq("store_id", store_id)
    .eq("phone", phone)
    .eq("is_closed", false);
  if (error) throw error;
}

export async function openNewSessionForOrder({ store_id, phone, order_id, locale = "pt" }) {
  const { data, error } = await supabase
    .from("conversations")
    .insert([{
      store_id, phone, order_id,
      state: "start", context: {}, history: [],
      locale, is_closed: false
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function logEvent(conversation_id, evt) {
    const { error } = await supabase.from("conversation_events").insert([{
        conversation_id,
        direction: evt.direction ?? "sys",
        payload: evt.payload ?? {},
        intent: evt.intent ?? null,
        state_before: evt.state_before ?? null,
        state_after: evt.state_after ?? null,
    }]);
    if (error) throw error;
}
