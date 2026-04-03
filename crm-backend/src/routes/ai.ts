import { Router } from "express";
import { createRequire } from "node:module";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { Conversation, Customer, Message, Agent, KnowledgeDoc } from "../models/index.js";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";

const _require = createRequire(import.meta.url);
const pdfParse = _require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["text/plain", "application/pdf", "text/markdown", "text/csv"];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith(".md") || file.originalname.endsWith(".txt")) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, TXT, MD, and CSV files are supported"));
    }
  },
});

function getGeminiClient() {
  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Gemini AI integration not configured. Set AI_INTEGRATIONS_GEMINI_BASE_URL and AI_INTEGRATIONS_GEMINI_API_KEY.");
  return new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "", baseUrl } });
}

async function extractText(buffer: Buffer, mimetype: string, filename: string): Promise<string> {
  if (mimetype === "application/pdf") {
    const data = await pdfParse(buffer);
    return data.text;
  }
  return buffer.toString("utf-8");
}

async function buildKnowledgeContext(): Promise<string> {
  const docs = await KnowledgeDoc.findAll({ order: [["createdAt", "ASC"]] });
  if (docs.length === 0) return "";
  const sections = docs.map((d) => `### ${d.originalName}\n${d.content}`).join("\n\n---\n\n");
  return `\n\n## Knowledge Base & SOPs\nUse the following documents as your primary reference when answering customer questions:\n\n${sections}\n\n---\n`;
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
        { model: Message, as: "messages", order: [["createdAt", "DESC"]], limit: 20 },
      ],
    });

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const messages = ((conversation as unknown as { messages: Message[] }).messages || []).reverse();
    const customer = (conversation as unknown as { customer: Customer }).customer;

    const chatHistory = messages.map((m) => ({
      role: m.sender === "agent" || m.sender === "bot" ? "model" as const : "user" as const,
      parts: [{ text: m.content }],
    }));

    if (chatHistory.length === 0) {
      res.json({ suggestions: ["Hello! How can I help you today?", "Hi there! What can I assist you with?", "Welcome! I'm here to help. What do you need?"] });
      return;
    }

    const knowledgeContext = await buildKnowledgeContext();
    const ai = getGeminiClient();

    const systemPrompt = `You are a helpful customer service agent for a company.
Your customer's name is ${customer?.name || "the customer"} and they are contacting via ${conversation.channel}.
${customer?.notes ? `Customer notes: ${customer.notes}` : ""}
${customer?.tags?.length ? `Customer tags: ${(customer.tags as string[]).join(", ")}` : ""}
${knowledgeContext}
Generate 3 concise, professional reply suggestions based on the conversation history.
Each suggestion should be on a new line, prefixed with a number (1., 2., 3.).
Keep replies brief (1-3 sentences), empathetic, and solution-focused.
Do not include any other text, just the 3 numbered suggestions.`;

    const contents = [
      { role: "user" as const, parts: [{ text: systemPrompt }] },
      { role: "model" as const, parts: [{ text: "Understood. I will generate 3 professional reply suggestions." }] },
      ...chatHistory.slice(-10),
      { role: "user" as const, parts: [{ text: "Generate 3 reply suggestions for the agent to use:" }] },
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: { maxOutputTokens: 500 },
    });

    const rawText = response.text ?? "";
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

    const knowledgeContext = await buildKnowledgeContext();
    const ai = getGeminiClient();

    const system = (systemPrompt ||
      `You are CommsBot, an intelligent customer service AI assistant.
You help customers with their queries efficiently, professionally, and empathetically.
You can handle questions about orders, products, returns, complaints, and general support.
Always be polite, helpful, and concise. If you cannot resolve an issue, offer to escalate to a human agent.`) + knowledgeContext;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const geminiMessages = [
      { role: "user" as const, parts: [{ text: system }] },
      { role: "model" as const, parts: [{ text: "Understood. I am CommsBot, ready to help." }] },
      ...messages.filter((m: { role: string; content: string }) => m.content).map((m: { role: string; content: string }) => ({
        role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
        parts: [{ text: m.content }],
      })),
    ];

    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: geminiMessages,
      config: { maxOutputTokens: 8192 },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
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
      role: (m.sender === "agent" || m.sender === "bot" ? "model" : "user") as "user" | "model",
      parts: [{ text: m.content }],
    }));

    const knowledgeContext = await buildKnowledgeContext();
    const ai = getGeminiClient();

    const systemText = `You are CommsBot, a customer service AI. Customer's name is ${customer?.name || "Customer"}.
Keep responses brief (1-2 sentences), professional, and helpful.
If the issue requires human intervention, say so and offer to connect them with an agent.${knowledgeContext}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user" as const, parts: [{ text: systemText }] },
        { role: "model" as const, parts: [{ text: "Understood." }] },
        ...chatHistory.slice(-10),
      ],
      config: { maxOutputTokens: 300 },
    });

    const content = response.text ?? "I'll connect you with an agent shortly.";

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

router.get("/ai/knowledge-base", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const docs = await KnowledgeDoc.findAll({
      attributes: ["id", "originalName", "mimeType", "sizeBytes", "createdAt"],
      order: [["createdAt", "DESC"]],
    });
    res.json(docs);
  } catch (err) {
    console.error("Knowledge base list error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/ai/knowledge-base", requireAuth, upload.single("file"), async (req: AuthRequest, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const content = await extractText(file.buffer, file.mimetype, file.originalname);
    if (!content.trim()) {
      res.status(400).json({ error: "Could not extract text from this file" });
      return;
    }

    const doc = await KnowledgeDoc.create({
      filename: `${Date.now()}_${file.originalname}`,
      originalName: file.originalname,
      mimeType: file.mimetype,
      content: content.trim(),
      sizeBytes: file.size,
    });

    res.status(201).json({
      id: doc.id,
      originalName: doc.originalName,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      createdAt: doc.createdAt,
    });
  } catch (err: unknown) {
    console.error("Knowledge base upload error:", err);
    const msg = err instanceof Error ? err.message : "Upload failed";
    res.status(500).json({ error: msg });
  }
});

router.delete("/ai/knowledge-base/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const doc = await KnowledgeDoc.findByPk(req.params.id);
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    await doc.destroy();
    res.status(204).end();
  } catch (err) {
    console.error("Knowledge base delete error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/ai/knowledge-base/:id/preview", requireAuth, async (req: AuthRequest, res) => {
  try {
    const doc = await KnowledgeDoc.findByPk(req.params.id);
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    res.json({ content: doc.content.slice(0, 2000) + (doc.content.length > 2000 ? "..." : "") });
  } catch (err) {
    console.error("Knowledge base preview error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
