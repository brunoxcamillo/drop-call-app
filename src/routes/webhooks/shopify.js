import { Router } from "express";
import shopifyVerify from "../../middleware/shopifyVerify.js";
import { handleShopifyWebhook } from "../../controllers/shopifyWebhookController.js";

const router = Router();

// Agora só JSON normal
router.post(
  "/",
  shopifyVerify,
  handleShopifyWebhook
);

export default router;
