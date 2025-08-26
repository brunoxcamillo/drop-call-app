// src/dialog/engine.js
export const States = {
  START: "start",
  AWAITING_CONFIRMATION: "awaiting_confirmation",
  AWAITING_NEW_ADDRESS: "awaiting_new_address",
  REVIEW_NEW_ADDRESS: "review_new_address",
  DONE: "done",
};

export const Intents = {
  CONFIRM: "confirm",
  CHANGE_ADDRESS: "change_address",
  PROVIDE_ADDRESS: "provide_address",
  GO_BACK: "go_back",                 // aqui só via "2" na revisão
  CANCEL_ADDR_CHANGE: "cancel_addr_change", // "3" na revisão
  UNKNOWN: "unknown",
};

const push = (s) => [...(Array.isArray(s.history) ? s.history : []), { state: s.state, ts: Date.now() }];

export function reduce(session, intent, messageText) {
  let state = session.state || States.START;
  let history = session.history || [];
  const ctx = { ...(session.context || {}) };
  const out = [];

  switch (state) {
    case States.START: {
      // processa a 1ª mensagem como menu magro
      history = push(session);
      if (intent === Intents.CONFIRM) {
        state = States.DONE; ctx.order_status = "confirmed";
        out.push({ type: "template", key: "on_confirm_order" });
      } else if (intent === Intents.CHANGE_ADDRESS) {
        state = States.AWAITING_NEW_ADDRESS;
        out.push({ type: "template", key: "on_change_address" });
      } else {
        state = States.AWAITING_CONFIRMATION;
        out.push({ type: "template", key: "on_invalid_response" });
        out.push({ type: "template", key: "on_main_menu_slim" }); // "1 confirmar • 2 mudar endereço"
      }
      break;
    }

    case States.AWAITING_CONFIRMATION: {
      if (intent === Intents.CONFIRM) {
        history = push(session);
        state = States.DONE; ctx.order_status = "confirmed";
        out.push({ type: "template", key: "on_confirm_order" });
      } else if (intent === Intents.CHANGE_ADDRESS) {
        history = push(session);
        state = States.AWAITING_NEW_ADDRESS;
        out.push({ type: "template", key: "on_change_address" });
      } else {
        out.push({ type: "template", key: "on_invalid_response" });
        out.push({ type: "template", key: "on_main_menu_slim" });
      }
      break;
    }

    case States.AWAITING_NEW_ADDRESS: {
      if (intent === Intents.PROVIDE_ADDRESS) {
        ctx.candidate_address = messageText;
        history = push(session);
        state = States.REVIEW_NEW_ADDRESS;
        out.push({ type: "template", key: "on_address_echo", vars: { address: messageText } });
        // Agora a revisão tem 3 opções: 1 confirmar, 2 editar, 3 cancelar mudança
        out.push({ type: "template", key: "on_confirm_address_prompt" });
      } else {
        // Só aceita TEXTO aqui (1/2/3 são inválidos)
        out.push({ type: "template", key: "on_invalid_response" });
        out.push({ type: "template", key: "on_change_address" });
      }
      break;
    }

    case States.REVIEW_NEW_ADDRESS: {
      if (intent === Intents.CONFIRM) {
        history = push(session);
        state = States.DONE; ctx.order_status = "address_change";
        out.push({ type: "template", key: "on_change_address_response" });
      } else if (intent === Intents.GO_BACK) {
        // editar: volta para digitar o endereço
        history = push(session);
        state = States.AWAITING_NEW_ADDRESS;
        out.push({ type: "template", key: "on_change_address" });
      } else if (intent === Intents.CANCEL_ADDR_CHANGE) {
        // cancelar A MUDANÇA (não cancela o pedido): volta ao menu magro
        state = States.AWAITING_CONFIRMATION;
        out.push({ type: "template", key: "on_main_menu_slim" });
      } else {
        out.push({ type: "template", key: "on_invalid_response" });
        out.push({ type: "template", key: "on_confirm_address_prompt" });
      }
      break;
    }

    case States.DONE: {
      out.push({ type: "template", key: "on_already_finished" });
      break;
    }

    default: {
      state = States.START;
      out.push({ type: "template", key: "on_fallback_restart" });
    }
  }

  return { state, context: ctx, history, out };
}
