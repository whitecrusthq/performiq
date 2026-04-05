import { Router } from "express";
import { Site } from "../models/index.js";
import { requireAuth, requireAdmin, AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.get("/sites", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const sites = await Site.findAll({ order: [["name", "ASC"]] });
    res.json(sites);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/sites", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, description, region } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ error: "Name is required" });
      return;
    }
    const site = await Site.create({ name: name.trim(), description: description ?? null, region: region ?? null });
    res.status(201).json(site);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/sites/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const site = await Site.findByPk(req.params.id);
    if (!site) { res.status(404).json({ error: "Site not found" }); return; }
    const { name, description, region, isActive } = req.body;
    if (name !== undefined) site.name = name.trim();
    if (description !== undefined) site.description = description ?? null;
    if (region !== undefined) site.region = region ?? null;
    if (isActive !== undefined) site.isActive = isActive;
    await site.save();
    res.json(site);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/sites/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const site = await Site.findByPk(req.params.id);
    if (!site) { res.status(404).json({ error: "Site not found" }); return; }
    await site.destroy();
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
