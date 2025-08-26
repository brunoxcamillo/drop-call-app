import { Router } from "express";
import { handleCreateOwner, handleGetOwners } from "../controllers/ownerController.js";

const router = Router();

// POST /owners
router.post("/", handleCreateOwner);
router.get("/", handleGetOwners);

export default router;