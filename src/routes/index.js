import { Router } from "express";
import ownersRouter from "./owners.js";
import shopifyRouter from "./webhooks/shopify.js";
import zapiRouter from "./webhooks/zapi.js";
const router = Router();

// Rotas

router.use("/owners", ownersRouter);
router.use("/webhooks/shopify", shopifyRouter);
router.use("/webhooks/zapi", zapiRouter);

export default router;
