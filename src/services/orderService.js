// src/services/orderService.js
import { supabase } from "../utils/supabaseClient.js";
import { normalizePhone } from "../utils/normalizePhone.js";

/** remove chaves com undefined (não toca em null) */
function stripUndefined(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  );
}

/** coerce helper para número (retorna null se vazio/NaN) */
function toNumberOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * UPSERT de pedido vindo da Shopify.
 * Requer UNIQUE em orders.shopify_id (ou constraint única composta).
 */
export async function upsertOrder(orderData, storeId) {
  try {
    const order = stripUndefined({
      // chaves de identidade
      shopify_id: orderData.id,        // precisa ser UNIQUE na tabela
      store_id: storeId,
      admin_graphql_api_id: orderData.admin_graphql_api_id || null,

      // básicos
      order_number: orderData.order_number,
      name: orderData.name,
      created_at: orderData.created_at,     // se preferir, grave em shopify_created_at
      cancelled_at: orderData.cancelled_at,
      tags: orderData.tags,
      source_name: orderData.source_name,
      currency: orderData.currency,

      // valores numéricos (normalizados)
      subtotal_price: toNumberOrNull(orderData.subtotal_price),
      total_price: toNumberOrNull(orderData.total_price),
      total_discounts: toNumberOrNull(orderData.total_discounts),
      total_shipping_price: toNumberOrNull(
        orderData.total_shipping_price_set?.shop_money?.amount
      ),
      total_tax: toNumberOrNull(orderData.total_tax),

      // Customer info
      customer_id: orderData.customer?.id ?? null,
      customer_email: orderData.customer?.email ?? null,
      customer_first_name: orderData.customer?.first_name ?? null,
      customer_last_name: orderData.customer?.last_name ?? null,
      customer_city: orderData.customer?.default_address?.city ?? null,
      customer_country: orderData.customer?.default_address?.country ?? null,
      customer_province_code: orderData.customer?.default_address?.province_code ?? null,
      customer_phone: normalizePhone(orderData.customer?.default_address?.phone) ?? null,

      // Billing address
      billing_city: orderData.billing_address?.city ?? null,
      billing_country: orderData.billing_address?.country ?? null,
      billing_province_code: orderData.billing_address?.province_code ?? null,

      // Shipping address
      shipping_city: orderData.shipping_address?.city ?? null,
      shipping_country: orderData.shipping_address?.country ?? null,
      shipping_province_code: orderData.shipping_address?.province_code ?? null,
      address1: orderData.shipping_address?.address1 ?? null,
      address2: orderData.shipping_address?.address2 ?? null,
    });

    // ⚠️ Se sua constraint for composta, troque para 'shopify_id,store_id'
    const { data, error } = await supabase
      .from("orders")
      .upsert(order, {
        onConflict: "shopify_id, store_id",
        ignoreDuplicates: false,   // queremos atualizar ao conflitar
        defaultToNull: false,      // não preencher ausentes com null automaticamente
      })
      .select()
      .limit(1);

    if (error) throw error;

    // retorna sempre um único registro
    return Array.isArray(data) ? data[0] : data;
  } catch (err) {
    console.error("❌ Error upserting order:", err);
    throw err;
  }
}

export async function updateOrder(orderId, updatedData) {
  try {
    const clean = stripUndefined(updatedData);
    const { data, error } = await supabase
      .from("orders")
      .update(clean)
      .eq("id", orderId)     // 'id' = PK interno do seu banco
      .select()
      .limit(1);

    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  } catch (err) {
    console.error("❌ Error updating order:", err);
    throw err;
  }
}

export async function getOrderByPhone(phone) {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("customer_phone", phone)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;
    return (data && data[0]) || null;
  } catch (err) {
    console.error("❌ Error fetching order by phone:", err);
    throw err;
  }
}


export async function getOrderById(orderId) {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error("❌ Error fetching order by id:", err);
    throw err;
  }
}

// NOVO: busca pelo par (shopify_id, store_id) — usa sua UNIQUE composta
export async function getOrderByShopifyId(shopifyId, storeId) {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("shopify_id", shopifyId)
      .eq("store_id", storeId)
      .single(); // UNIQUE (shopify_id, store_id) garante 1 linha
    if (error) throw error;
    return data;
  } catch (err) {
    console.error("❌ Error fetching order by shopify_id + store_id:", err);
    throw err;
  }
}

