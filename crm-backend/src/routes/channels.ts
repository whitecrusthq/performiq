import { Router } from "express";
import { Channel } from "../models/index.js";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.get("/channels", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const channels = await Channel.findAll({ order: [["type", "ASC"]] });
    res.json(channels.map((c) => ({
      id: c.id,
      type: c.type,
      name: c.name,
      isConnected: c.isConnected,
      webhookVerifyToken: c.webhookVerifyToken,
      phoneNumberId: c.phoneNumberId,
      wabaId: c.wabaId,
      pageId: c.pageId,
      instagramAccountId: c.instagramAccountId,
      hasAccessToken: !!c.accessToken,
      hasPageAccessToken: !!c.pageAccessToken,
      createdAt: c.createdAt,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/channels", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { type, name } = req.body;
    if (!type || !name) {
      res.status(400).json({ error: "type and name are required" });
      return;
    }
    const existing = await Channel.findOne({ where: { type } });
    if (existing) {
      res.status(409).json({ error: "Channel of this type already exists. Update it instead." });
      return;
    }
    const channel = await Channel.create({ type, name });
    res.status(201).json({ id: channel.id, type: channel.type, name: channel.name, isConnected: false, webhookVerifyToken: channel.webhookVerifyToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/channels/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const channel = await Channel.findByPk(req.params.id);
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }

    const { name, accessToken, phoneNumberId, wabaId, pageId, pageAccessToken, instagramAccountId } = req.body;

    if (name) channel.name = name;
    if (accessToken !== undefined) channel.accessToken = accessToken || null;
    if (phoneNumberId !== undefined) channel.phoneNumberId = phoneNumberId || null;
    if (wabaId !== undefined) channel.wabaId = wabaId || null;
    if (pageId !== undefined) channel.pageId = pageId || null;
    if (pageAccessToken !== undefined) channel.pageAccessToken = pageAccessToken || null;
    if (instagramAccountId !== undefined) channel.instagramAccountId = instagramAccountId || null;

    const isConfigured = (channel.type === "whatsapp" && channel.accessToken && channel.phoneNumberId) ||
      (channel.type === "facebook" && channel.pageAccessToken && channel.pageId) ||
      (channel.type === "instagram" && channel.pageAccessToken && channel.instagramAccountId);

    channel.isConnected = !!isConfigured;
    await channel.save();

    res.json({
      id: channel.id,
      type: channel.type,
      name: channel.name,
      isConnected: channel.isConnected,
      webhookVerifyToken: channel.webhookVerifyToken,
      phoneNumberId: channel.phoneNumberId,
      wabaId: channel.wabaId,
      pageId: channel.pageId,
      instagramAccountId: channel.instagramAccountId,
      hasAccessToken: !!channel.accessToken,
      hasPageAccessToken: !!channel.pageAccessToken,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/channels/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const channel = await Channel.findByPk(req.params.id);
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }
    await channel.destroy();
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
