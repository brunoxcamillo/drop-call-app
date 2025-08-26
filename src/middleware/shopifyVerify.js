import { getStoreByDomain } from "../services/storeService.js";

export default async function shopifyVerify(req, res, next) {
  console.log("📩 Shopify webhook recebido");

  /*const storeDomain = req.get("x-shopify-shop-domain");
  if (!storeDomain) return res.status(400).send("Missing store domain");

  const store = await getStoreByDomain(storeDomain);
  if (!store) return res.status(404).send("Store not found");

  // ⚡ Sem validação HMAC
  req.store = store;*/
  next();
}
