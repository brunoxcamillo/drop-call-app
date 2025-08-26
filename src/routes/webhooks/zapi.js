import { Router } from "express";
import { handleZapiWebhook } from "../../controllers/zapiWebhookController.js";

const router = Router();

// Agora só JSON normal
router.post("/", handleZapiWebhook);

export default router;
