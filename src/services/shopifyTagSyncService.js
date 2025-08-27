// src/services/shopifyTagSyncService.js
import { addOrderTagsGQL, addOrderTagsREST } from "../utils/shopifyAdmin.js";
import logger from "../utils/logger.js";
import { getOrderById } from "./orderService.js";
import { getStoreById } from "./storeService.js";

const statusToTags = {
    confirmed: ["confirmed"],
    address_change: ["address_change_requested"],
};

export async function syncShopifyOrderTags({ order_id, store_id }) {
    const order = await getOrderById(order_id);
    const store = await getStoreById(store_id);
    if (!order || !store) return;

    const tags = statusToTags[order.status];
    if (!tags) return;

    const storeDomain = store.domain;
    const accessToken = store.shopify_access_token;
    if (!storeDomain || !accessToken) {
        logger.warn(`[Shopify] Loja sem credenciais: store_id=${order.store_id}`);
        return;
    }

    const orderId = order.shopify_id;
    const orderGid = order.admin_graphql_api_id || (orderId ? `gid://shopify/Order/${orderId}` : null);

    try {
        if (!orderGid && !orderId) throw new Error("Sem ID de pedido (shopify_id/admin_graphql_api_id)");
        // Tenta GraphQL primeiro (adição segura)
        if (orderGid) {
            await addOrderTagsGQL({ storeDomain, accessToken, orderGid, tags });
            logger.info(`[Shopify] tagsAdd OK (${tags.join(", ")}) -> ${orderGid}`);
            return;
        }
        // Se não tiver GID, cai direto no REST
        await addOrderTagsREST({ storeDomain, accessToken, orderId, tags });
        logger.info(`[Shopify] REST tags merged -> order ${orderId}`);
    } catch (err) {
        logger.error(`[Shopify] Falha ao sincronizar tags: ${err.message}`);
        // Tenta fallback REST se GraphQL falhar e houver orderId
        if (orderId) {
            try {
                await addOrderTagsREST({ storeDomain, accessToken, orderId, tags });
                logger.info(`[Shopify] Fallback REST OK -> order ${orderId}`);
            } catch (err2) {
                logger.error(`[Shopify] Fallback REST falhou: ${err2.message}`);
            }
        }
    }
}
