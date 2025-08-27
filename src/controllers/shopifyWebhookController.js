//shopifyWebhookController.js
import logger from "../utils/logger.js";
import { getOrderByShopifyId, updateOrder, upsertOrder } from "../services/orderService.js";
import { insertLineItems } from "../services/lineItemService.js";
import { queue } from "../queue.js";
import { getStoreByDomain } from "../services/storeService.js";
import { closeOpenSessionsForPhone } from "../services/conversationService.js";
import { orderStatusTypes } from "../utils/supabaseClient.js";


export async function handleShopifyWebhook(req, res) {

    const shopDomain = req.get("x-shopify-shop-domain");
    const topic = req.get("x-shopify-topic");
    const payload = req.body;

    const store = await getStoreByDomain(shopDomain);

    if (!store) {
        logger.info(`Loja não encontrada: ${shopDomain}`);
        return res.status(200).send("Loja não encontrada");
    }
    if (process.env.TEST == "1") {
        // Fechar sessões abertas para o telefone do pedido (se houver)
        await closeOpenSessionsForPhone({ store_id: store.id, phone: "48732081430"/*payload.default_address?.phone || payload.phone*/ });
    }

    logger.info(`📩 Webhook Shopify: shop=${store.name} topic=${topic}`);

    try {

        switch (topic) {
            case "orders/create":
                var order = await upsertOrder(payload, store.id);
                // Fechar sessões abertas para o telefone do pedido (se houver)
                await closeOpenSessionsForPhone({ store_id: store.id, phone: order.customer_phone });

                if (process.env.TEST == "1") {
                    await updateOrder(order.id, { customer_phone: "48732081430" });
                }
                
                await insertLineItems(order.id, payload.line_items);

                logger.info(`✅ Pedido criado/atualizado: ${payload.id}`);

                await queue.add("send_whatsapp_confirmation", {
                    type: "send_whatsapp_confirmation",
                    payload: { orderId: order.id, storeId: store.id },
                }, { jobId: `confirm:${order.id}` });
                break;


            case "orders/cancelled":
                // TODO
                var order = await getOrderByShopifyId(payload.id, store.id);
                if (order) {
                    await updateOrder(order.id, { status: orderStatusTypes.canceled });
                }

                logger.info(`❌ Pedido cancelado: ${payload.id}`);
                break;

            default:
                logger.warn(`Evento não tratado: ${topic}`);
        }

        res.status(200).send("ok");
    } catch (err) {
        logger.error("Erro ao processar webhook:", err);
        res.status(500).send("error");
    }
}


