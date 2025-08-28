//zapiWebhookController.js
import logger from "../utils/logger.js";
import { getOrderByPhone } from "../services/orderService.js";
import { getStoreById } from "../services/storeService.js";
import { queue } from "../queue.js";
import { loadOrCreateSession, saveSession, logEvent } from "../services/conversationService.js";
import { reduce, States, Intents } from "../dialog/engine.js";
import { toFormData } from "axios";

function parseIntentNumbersOnly(text, state, cc) {
    const t = (text || "").trim().toLowerCase();

    // normalizar somente dígitos
    const isDigitOnly = /^[0-9]+$/.test(t);
    if (state === States.AWAITING_CONFIRMATION || state === States.START) {
        // Passo 1 (menu magro): 1 confirmar, 2 mudar endereço
        if (t === "1") return Intents.CONFIRM;
        if (t === "2") return Intents.CHANGE_ADDRESS;
       
        return Intents.UNKNOWN; // qualquer outra coisa -> inválido
    }

    if (state === States.AWAITING_NEW_ADDRESS) {
        // Aqui precisa de TEXTO do endereço. Números 1/2/3 são inválidos.
        if (t === "1" || t === "2" || t === "3") return Intents.UNKNOWN;
        // qualquer outra entrada (não numérica) é o endereço proposto
        return Intents.PROVIDE_ADDRESS;
    }

    if (state === States.REVIEW_NEW_ADDRESS) {
        // Revisão do endereço: 1 confirmar, 2 editar, 3 cancelar mudança (volta ao menu)
        if (t === "1") return Intents.CONFIRM;
        if (t === "2") return Intents.GO_BACK;
        if (t === "3") return Intents.CANCEL_ADDR_CHANGE;
        return Intents.UNKNOWN;
    }

    // DONE e demais: não aceitamos nada além dos fluxos acima
    return Intents.UNKNOWN;
}



export async function handleZapiWebhook(req, res) {
    try {
        const { phone, text } = req.body;
        const message = text?.message?.trim() || "";

        // 1) Carregar pedido e loja (igual ao seu fluxo atual)
        const order = await getOrderByPhone(phone);
        if (!order) {
            logger.info(`Pedido não encontrado para o telefone: ${phone}`);
            return res.status(200).send("Pedido não encontrado");
        }
        const store = await getStoreById(order.store_id);
        const cc = store.country_code;


        // 2) Carregar/abrir sessão de conversa
        const session = await loadOrCreateSession({
            store_id: store.id,
            phone,
            order_id: order.id,
        });

        // 3) Determinar intenção
        let intent = parseIntentNumbersOnly(message, session.state, cc);

        // 4) Rodar o motor de diálogo (FSM)
        const result = reduce(session, intent, message);

        // 5) Persistir sessão e logar evento
        await logEvent(session.id, {
            direction: "in",
            payload: req.body,
            intent,
            state_before: session.state,
            state_after: result.state,
        });
        await saveSession(session.id, result.state, result.context, result.history);

        // 6) Atualizações de status do pedido (efeitos colaterais controlados)
        // - CONFERIDO: confirmado
        // - CANCELADO: cancelado
        // - ADDRESS_CHANGE confirmado no REVIEW_NEW_ADDRESS
        if (result.context?.order_status && result.state === States.DONE) {
            // Atualização de status acontece no worker quando envia a mensagem final
            // para manter idempotência em um lugar só.
        }

        // 7) Enfileira as mensagens de saída para o worker (render + envio via Z-API)
        if (result.out?.length) {
            await queue.add(
                "send_dialog_messages",
                {
                    type: "send_dialog_messages",
                    payload: {
                        storeId: store.id,
                        phone,
                        cc,
                        orderId: order.id,
                        messages: result.out,
                        context: result.context,
                    },
                },
                { jobId: `dlg:${order.id}:${Date.now()}` }
            );

            await logEvent(session.id, {
                direction: "out",
                payload: { messages: result.out },
                state_before: result.state,
                state_after: result.state,
            });
        }

        return res.status(200).send("ok");
    } catch (error) {
        logger.error("Erro ao processar webhook Z-API", error);
        return res.status(200).send("ok"); // não force retry síncrono
    }
}



