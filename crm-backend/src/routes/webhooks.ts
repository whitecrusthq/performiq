import { Router } from "express";
import crypto from "crypto";
import { Channel, Customer, Conversation, Message } from "../models/index.js";

const router = Router();

async function findOrCreateCustomer(phone: string, name: string, channel: "whatsapp" | "facebook" | "instagram") {
  let customer = await Customer.findOne({ where: { phone } });
  if (!customer) {
    customer = await Customer.create({
      name: name || phone,
      phone,
      channel,
      tags: [],
    });
  }
  return customer;
}

async function findOrCreateConversation(customerId: number, channel: "whatsapp" | "facebook" | "instagram") {
  let conversation = await Conversation.findOne({
    where: { customerId, status: ["open", "pending"] as unknown as string },
  });
  if (!conversation) {
    conversation = await Conversation.create({
      customerId,
      channel,
      status: "open",
      unreadCount: 0,
    });
  }
  return conversation;
}

async function storeIncomingMessage(conversation: Conversation, text: string) {
  await Message.create({
    conversationId: conversation.id,
    sender: "customer",
    content: text,
    isRead: false,
  });

  conversation.unreadCount = (conversation.unreadCount || 0) + 1;
  conversation.lastMessageAt = new Date();
  await conversation.save();
}

function verifyMetaSignature(body: string, signature: string, appSecret: string): boolean {
  const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(body).digest("hex")}`;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

router.get("/webhooks/whatsapp", async (req, res) => {
  const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query as Record<string, string>;
  if (mode !== "subscribe") {
    res.status(400).json({ error: "Invalid mode" });
    return;
  }

  const channel = await Channel.findOne({ where: { type: "whatsapp" } });
  if (!channel || channel.webhookVerifyToken !== token) {
    res.status(403).json({ error: "Invalid verify token" });
    return;
  }

  res.send(challenge);
});

router.post("/webhooks/whatsapp", async (req, res) => {
  const body = req.body;

  if (body.object !== "whatsapp_business_account") {
    res.sendStatus(200);
    return;
  }

  try {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "messages") continue;
        const value = change.value;

        for (const message of value.messages || []) {
          if (message.type !== "text") continue;

          const phone = message.from;
          const text = message.text?.body || "";
          const profileName = value.contacts?.[0]?.profile?.name || phone;

          const customer = await findOrCreateCustomer(`+${phone}`, profileName, "whatsapp");
          const conversation = await findOrCreateConversation(customer.id, "whatsapp");
          await storeIncomingMessage(conversation, text);
        }
      }
    }
  } catch (err) {
    console.error("WhatsApp webhook error:", err);
  }

  res.sendStatus(200);
});

router.get("/webhooks/facebook", async (req, res) => {
  const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query as Record<string, string>;
  if (mode !== "subscribe") {
    res.status(400).json({ error: "Invalid mode" });
    return;
  }

  const channel = await Channel.findOne({ where: { type: "facebook" } });
  if (!channel || channel.webhookVerifyToken !== token) {
    res.status(403).json({ error: "Invalid verify token" });
    return;
  }

  res.send(challenge);
});

router.post("/webhooks/facebook", async (req, res) => {
  const body = req.body;

  if (body.object !== "page") {
    res.sendStatus(200);
    return;
  }

  try {
    for (const entry of body.entry || []) {
      for (const messaging of entry.messaging || []) {
        if (!messaging.message?.text) continue;

        const senderId = messaging.sender.id;
        const text = messaging.message.text;

        const customer = await findOrCreateCustomer(senderId, `FB User ${senderId.slice(-4)}`, "facebook");
        const conversation = await findOrCreateConversation(customer.id, "facebook");
        await storeIncomingMessage(conversation, text);
      }
    }
  } catch (err) {
    console.error("Facebook webhook error:", err);
  }

  res.sendStatus(200);
});

router.get("/webhooks/instagram", async (req, res) => {
  const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query as Record<string, string>;
  if (mode !== "subscribe") {
    res.status(400).json({ error: "Invalid mode" });
    return;
  }

  const channel = await Channel.findOne({ where: { type: "instagram" } });
  if (!channel || channel.webhookVerifyToken !== token) {
    res.status(403).json({ error: "Invalid verify token" });
    return;
  }

  res.send(challenge);
});

router.post("/webhooks/instagram", async (req, res) => {
  const body = req.body;

  if (body.object !== "instagram") {
    res.sendStatus(200);
    return;
  }

  try {
    for (const entry of body.entry || []) {
      for (const messaging of entry.messaging || []) {
        if (!messaging.message?.text) continue;

        const senderId = messaging.sender.id;
        const text = messaging.message.text;

        const customer = await findOrCreateCustomer(senderId, `IG User ${senderId.slice(-4)}`, "instagram");
        const conversation = await findOrCreateConversation(customer.id, "instagram");
        await storeIncomingMessage(conversation, text);
      }
    }
  } catch (err) {
    console.error("Instagram webhook error:", err);
  }

  res.sendStatus(200);
});

router.post("/webhooks/simulate", async (req, res) => {
  try {
    const { channel, customerName, customerPhone, message } = req.body;
    if (!channel || !message) {
      res.status(400).json({ error: "channel and message required" });
      return;
    }

    const phone = customerPhone || `+sim_${Date.now()}`;
    const name = customerName || "Test Customer";

    const customer = await findOrCreateCustomer(phone, name, channel as "whatsapp" | "facebook" | "instagram");
    const conversation = await findOrCreateConversation(customer.id, channel as "whatsapp" | "facebook" | "instagram");
    await storeIncomingMessage(conversation, message);

    res.json({ success: true, conversationId: conversation.id, customerId: customer.id });
  } catch (err) {
    console.error("Simulate error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
