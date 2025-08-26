import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

export const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const orderStatusTypes = {
    pending_contact: "pending_contact",
    pending_confirmation: "pending_confirmation",
    invalid_response: "invalid_response",
    confirmed: "confirmed",
    canceled: "canceled",
    sent: "sent",
    returned: "returned",
    completed: "completed",
    address_change: "address_change"
}

export const messageTypes = {
    on_confirm_order: "on_confirm_order",                // resposta pós-confirmação
    on_cancel_order: "on_cancel_order",                  // resposta pós-cancelamento
    on_change_address: "on_change_address",              // pedir endereço
    on_change_address_response: "on_change_address_response", // resposta após confirmar endereço
    on_invalid_response: "on_invalid_response",          // fallback

    // novos (antes estavam hardcoded em PT):
    on_went_back: "on_went_back",                        // "Ok, voltei um passo."
    on_cannot_go_back: "on_cannot_go_back",              // "Não há passo anterior."
    on_address_echo: "on_address_echo",                  // "Recebi: {{address}}"
    on_confirm_address_prompt: "on_confirm_address_prompt", // "Confirma? …"
    on_already_finished: "on_already_finished",          // "Conversa finalizada"
    on_fallback_restart: "on_fallback_restart",           // "Vamos recomeçar…"
    on_cancel_confirm_prompt: "on_cancel_confirm_prompt", // "Confirma cancelamento?"
    on_cancel_abort: "on_cancel_abort",                    // "Cancelamento abortado"
    on_main_menu_slim: "on_main_menu_slim"                // "Menu principal"
};
