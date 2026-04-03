import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { Conversation, Customer, Message, Agent } from "../models/index.js";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";

const router = Router();

function getAnthropicClient() {
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;

  if (!baseURL || !apiKey) {
    throw new Error("Anthropic AI integration not configured");
  }

  return new Anthropic({ baseURL, apiKey });
}

router.post("/ai/suggest-reply", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { conversationId } = req.body;

    if (!conversationId) {
      res.status(400).json({ error: "conversationId is required" });
      return;
    }

    const conversation = await Conversation.findByPk(conversationId, {
      include: [
        { model: Customer, as: "customer", attributes: ["name", "channel", "notes", "tags"] },
        { model: Agent, as: "assignedAgent", attributes: ["name"], required: false },
        {
          model: Message,
          as: "messages",
          order: [["createdAt", "DESC"]],
          limit: 20,
        },
      ],
    });

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const messages = ((conversation as unknown as { messages: Message[] }).messages || []).reverse();
    const customer = (conversation as unknown as { customer: Customer }).customer;

    const chatHistory = messages.map((m) => ({
      role: m.sender === "agent" || m.sender === "bot" ? "assistant" as const : "user" as const,
      content: m.content,
    }));

    if (chatHistory.length === 0) {
      res.json({ suggestions: ["Hello! How can I help you today?", "Hi there! What can I assist you with?", "Welcome! I'm here to help. What do you need?"] });
      return;
    }

    const anthropic = getAnthropicClient();

    const systemPrompt = `You are a helpful customer service agent for a company. 
Your customer's name is ${customer?.name || "the customer"} and they are contacting via ${conversation.channel}.
${customer?.notes ? `Customer notes: ${customer.notes}` : ""}
${customer?.tags?.length ? `Customer tags: ${(customer.tags as string[]).join(", ")}` : ""}

Generate 3 concise, professional reply suggestions based on the conversation history.
Each suggestion should be on a new line, prefixed with a number (1., 2., 3.).
Keep replies brief (1-3 sentences), empathetic, and solution-focused.
Do not include any other text, just the 3 numbered suggestions.`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 500,
      system: systemPrompt,
      messages: chatHistory.slice(-10),
    });

    const rawText = response.content[0].type === "text" ? response.content[0].text : "";
    const lines = rawText.split("\n").filter((l) => l.trim().match(/^\d+\./));
    const suggestions = lines.map((l) => l.replace(/^\d+\.\s*/, "").trim()).filter(Boolean);

    res.json({ suggestions: suggestions.length > 0 ? suggestions : [rawText.trim()] });
  } catch (err: unknown) {
    console.error("AI suggest error:", err);
    const errMsg = err instanceof Error ? err.message : "AI error";
    res.status(500).json({ error: errMsg });
  }
});

router.post("/ai/chat", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { messages, systemPrompt } = req.body;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "messages array is required" });
      return;
    }

    const anthropic = getAnthropicClient();

    const system = systemPrompt ||
      `You are HiraBot, an intelligent customer service AI assistant. 
You help customers with their queries efficiently, professionally, and empathetically.
You can handle questions about orders, products, returns, complaints, and general support.
Always be polite, helpful, and concise. If you cannot resolve an issue, offer to escalate to a human agent.`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const stream = anthropic.messages.stream({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system,
      messages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: unknown) {
    console.error("AI chat error:", err);
    res.write(`data: ${JSON.stringify({ error: "AI unavailable", done: true })}\n\n`);
    res.end();
  }
});

router.post("/ai/auto-respond", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { conversationId } = req.body;

    if (!conversationId) {
      res.status(400).json({ error: "conversationId is required" });
      return;
    }

    const conversation = await Conversation.findByPk(conversationId, {
      include: [
        { model: Customer, as: "customer", attributes: ["name", "channel"] },
        { model: Message, as: "messages", order: [["createdAt", "ASC"]], limit: 20 },
      ],
    });

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const messages = ((conversation as unknown as { messages: Message[] }).messages || []);
    const customer = (conversation as unknown as { customer: Customer }).customer;

    const chatHistory = messages.map((m) => ({
      role: m.sender === "agent" || m.sender === "bot" ? "assistant" as const : "user" as const,
      content: m.content,
    }));

    const anthropic = getAnthropicClient();

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 300,
      system: `You are HiraBot, a customer service AI. Customer's name is ${customer?.name || "Customer"}. 
Keep responses brief (1-2 sentences), professional, and helpful. 
If the issue requires human intervention, say so and offer to connect them with an agent.`,
      messages: chatHistory.slice(-10),
    });

    const content = response.content[0].type === "text" ? response.content[0].text : "I'll connect you with an agent shortly.";

    await Message.create({
      conversationId: conversation.id,
      sender: "bot",
      content,
      isRead: true,
    });

    await Conversation.update(
      { lastMessageAt: new Date(), unreadCount: 0 },
      { where: { id: conversationId } }
    );

    res.json({ response: content });
  } catch (err) {
    console.error("Auto-respond error:", err);
    res.status(500).json({ error: "AI unavailable" });
  }
});

export default router;
