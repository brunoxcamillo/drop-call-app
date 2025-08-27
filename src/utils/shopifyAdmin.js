// src/utils/shopifyAdmin.js
import axios from "axios";
import logger from "../utils/logger.js";

const API_VERSION = process.env.SHOPIFY_API_VERSION || "2025-07";

function base(storeDomain) {
    const root = `https://${storeDomain}/admin/api/${API_VERSION}`;
    return {
        graphql: `${root}/graphql.json`,
        restOrder: (id) => `${root}/orders/${id}.json`,
    };
}
function headers(token) {
    return { "X-Shopify-Access-Token": token, "Content-Type": "application/json" };
}

/** Adiciona tags via GraphQL (não sobrescreve). */
export async function addOrderTagsGQL({ storeDomain, accessToken, orderGid, tags }) {
    const mutation = `
    mutation AddTags($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) {
        userErrors { field message }
        node { id }
      }
    }`;
    const { graphql } = base(storeDomain);
    const { data } = await axios.post(
        graphql,
        { query: mutation, variables: { id: orderGid, tags } },
        { headers: headers(accessToken), timeout: 15000 }
    );
    const errs = data?.data?.tagsAdd?.userErrors || data?.errors;
    if (errs?.length) throw new Error(`tagsAdd error: ${JSON.stringify(errs)}`);
    return data?.data?.tagsAdd?.node?.id || orderGid;
}

/** Fallback REST: busca tags atuais -> mescla -> PUT (sobrescreve com merge). */
export async function addOrderTagsREST({ storeDomain, accessToken, orderId, tags }) {
    const urls = base(storeDomain);
    const h = headers(accessToken);

    const getRes = await axios.get(urls.restOrder(orderId), { headers: h, timeout: 15000 });
    const current = (getRes.data?.order?.tags || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

    const merged = Array.from(new Set([...current, ...tags]));
    await axios.put(urls.restOrder(orderId), { order: { id: orderId, tags: merged.join(", ") } }, { headers: h, timeout: 15000 });
    return merged;
}
