// src/services/lineItemService.js
import { supabase } from "../utils/supabaseClient.js";

export async function insertLineItems(orderId, lineItemsData) {
  try {
    if (!lineItemsData || lineItemsData.length === 0) return [];

    const items = lineItemsData.map((item) => ({
      shopify_id: item.id,
      order_id: orderId,
      title: item.title,
      sku: item.sku,
      variant_id: item.variant_id,
      quantity: item.quantity,
      price: item.price,
      total_discount: item.total_discount,
      requires_shipping: item.requires_shipping,
      taxable: item.taxable,
      vendor: item.vendor,
    }), this);

    const { data, error } = await supabase
      .from("line_items")
      .upsert(items) // evita duplicar
      .select();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("❌ Error inserting line items:", err);
    throw err;
  }
}

export async function getLineItemsByOrderId(orderId) {
  try {
    const { data, error } = await supabase
      .from("line_items")
      .select()
      .eq("order_id", orderId);

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("❌ Error fetching line items:", err);
    throw err;
  }
}