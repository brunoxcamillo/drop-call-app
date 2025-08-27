import { getLineItemsByOrderId } from "../services/lineItemService.js";

export async function formatMessage(order, store) {
    const customerName = `${order.customer_first_name || ""} ${order.customer_last_name || ""}`.trim();
    const address = `${order.address1 || ""} ${order.address2 || ""}`.trim();
    const itemsData = await getLineItemsByOrderId(order.id);
    const items = itemsData.map(item => `*${item.title}* (_x${item.quantity})_`).join("\n\n");

    return store.message_text
        .replace("{{order_number}}", order.order_number)
        .replace("{{customer_name}}", customerName)
        .replace("{{address}}", address)
        .replace("{{items}}", items)
        .replace("{{store_name}}", store.name || "")
        .replace("{{total_price}}", formatToFloatString(order.total_price) || "")
        .replace("{{currency}}", order.currency || "")
}

function formatToFloatString(str) {
    const numero = parseFloat(str);
    if (isNaN(numero)) return null; // trata caso de string inválida
    return numero.toFixed(2); // sempre retorna string "xxx.xx"
}