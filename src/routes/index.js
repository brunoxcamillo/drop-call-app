import { Router } from "express";
import shopifyRouter from "./webhooks/shopify.js";
import zapiRouter from "./webhooks/zapi.js";

const router = Router();



// Rotas
router.use("/webhooks/shopify", shopifyRouter);
router.use("/webhooks/zapi", zapiRouter);

export default router;
