import logger from "../utils/logger.js";
import { createOwner, getOwners } from "../services/ownerService.js";

export async function handleCreateOwner(req, res) {
  const { name, email, phone } = req.body;

  if (!name || !email || !phone) {
    return res.status(400).json({ error: "Name, email, and phone are required" });
  }

  try {
    const owner = await createOwner({ name, email, phone });
    logger.info(`✅ Owner criado: ${owner.id}`);
    res.status(201).json(owner);
  } catch (err) {
    logger.error("Erro ao criar owner:", err);
    res.status(500).json({ error: "Failed to create owner" });
  }
}

export async function handleGetOwners(req, res) {
    try {
        const owners = await getOwners();
        logger.info(`✅ Owners encontrados: ${owners.length}`);
        res.status(200).json(owners);
    } catch (err) {
        logger.error("Erro ao buscar owners:", err);
        res.status(500).json({ error: "Failed to retrieve owners" });
    }
}