import { Router } from "express";
import { Channel } from "../models/index.js";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";

const router = Router();

function serializeChannel(c: Channel) {
  return {
    id: c.id,
    type: c.type,
    name: c.name,
    siteId: c.siteId,
    isConnected: c.isConnected,
    webhookVerifyToken: c.webhookVerifyToken,
    phoneNumberId: c.phoneNumberId,
    wabaId: c.wabaId,
    pageId: c.pageId,
    instagramAccountId: c.instagramAccountId,
    hasAccessToken: !!c.accessToken,
    hasPageAccessToken: !!c.pageAccessToken,
    hasTwitterCreds: !!(c.twitterApiKey && c.twitterBearerToken),
    twitterApiKey: c.twitterApiKey,
    metadata: c.metadata,
    createdAt: c.createdAt,
  };
}

function checkIsConfigured(channel: Channel): boolean {
  switch (channel.type) {
    case "whatsapp":
      return !!(channel.accessToken && channel.phoneNumberId);
    case "facebook":
      return !!(channel.pageAccessToken && channel.pageId);
    case "instagram":
      return !!(channel.pageAccessToken && channel.instagramAccountId);
    case "twitter":
      return !!(channel.twitterApiKey && channel.twitterBearerToken);
    case "widget":
      return true;
    default:
      return false;
  }
}

router.get("/channels", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const channels = await Channel.findAll({ order: [["type", "ASC"]] });
    res.json(channels.map(serializeChannel));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/channels", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { type, name, siteId } = req.body;
    if (!type || !name) {
      res.status(400).json({ error: "type and name are required" });
      return;
    }
    const channel = await Channel.create({ type, name, siteId: siteId ?? null });
    if (type === "widget") {
      channel.isConnected = true;
      await channel.save();
    }
    res.status(201).json(serializeChannel(channel));
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

    const {
      name,
      siteId,
      accessToken,
      phoneNumberId,
      wabaId,
      pageId,
      pageAccessToken,
      instagramAccountId,
      twitterApiKey,
      twitterApiSecret,
      twitterBearerToken,
      twitterAccessToken,
      twitterAccessTokenSecret,
      metadata,
    } = req.body;

    if (name) channel.name = name;
    if (siteId !== undefined) channel.siteId = siteId ?? null;
    if (accessToken !== undefined) channel.accessToken = accessToken || null;
    if (phoneNumberId !== undefined) channel.phoneNumberId = phoneNumberId || null;
    if (wabaId !== undefined) channel.wabaId = wabaId || null;
    if (pageId !== undefined) channel.pageId = pageId || null;
    if (pageAccessToken !== undefined) channel.pageAccessToken = pageAccessToken || null;
    if (instagramAccountId !== undefined) channel.instagramAccountId = instagramAccountId || null;
    if (twitterApiKey !== undefined) channel.twitterApiKey = twitterApiKey || null;
    if (twitterApiSecret !== undefined) channel.twitterApiSecret = twitterApiSecret || null;
    if (twitterBearerToken !== undefined) channel.twitterBearerToken = twitterBearerToken || null;
    if (twitterAccessToken !== undefined) channel.twitterAccessToken = twitterAccessToken || null;
    if (twitterAccessTokenSecret !== undefined) channel.twitterAccessTokenSecret = twitterAccessTokenSecret || null;
    if (metadata !== undefined && typeof metadata === "object") {
      channel.metadata = { ...(channel.metadata ?? {}), ...metadata };
    }

    channel.isConnected = checkIsConfigured(channel);
    await channel.save();

    res.json(serializeChannel(channel));
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
