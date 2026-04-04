import { Router } from "express";
import { Op } from "sequelize";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import { RetentionSettings } from "../models/RetentionSettings.js";
import { ClosedConversation } from "../models/ClosedConversation.js";
import { ClosedMessage } from "../models/ClosedMessage.js";
import { getAiSettings, generateText } from "../lib/ai-provider.js";

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getOrCreateSettings() {
  let s = await RetentionSettings.findOne({ order: [["id", "ASC"]] });
  if (!s) {
    s = await RetentionSettings.create({ retentionDays: 90, summarizeBeforeDelete: true, autoRunEnabled: false });
  }
  return s;
}

async function summarizeMessages(messages: Array<{ sender: string; content: string }>, customerName: string): Promise<string> {
  const transcript = messages
    .map((m) => `[${m.sender.toUpperCase()}]: ${m.content}`)
    .join("\n");

  const prompt = `You are summarizing a customer service conversation for archiving. Provide a concise 3-5 sentence summary covering: the customer's main issue/request, key actions taken, and the resolution outcome. Be factual and neutral.

Customer: ${customerName}

Conversation:
${transcript.slice(0, 6000)}

Summary:`;

  try {
    const settings = await getAiSettings();
    const result = await generateText(settings, "You are a helpful assistant that summarizes customer service conversations concisely.", [{ role: "user", content: prompt }]);
    return result.trim();
  } catch {
    // Fallback: heuristic summary
    const customerMsgs = messages.filter((m) => m.sender === "customer").length;
    const agentMsgs = messages.filter((m) => m.sender === "agent").length;
    return `Conversation with ${customerName} — ${messages.length} messages (${customerMsgs} from customer, ${agentMsgs} from agent/bot). Full transcript was archived and deleted per retention policy.`;
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/retention/settings
router.get("/retention/settings", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const s = await getOrCreateSettings();
    res.json({ retentionDays: s.retentionDays, summarizeBeforeDelete: s.summarizeBeforeDelete, autoRunEnabled: s.autoRunEnabled });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/retention/settings
router.put("/retention/settings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { retentionDays, summarizeBeforeDelete, autoRunEnabled } = req.body;
    const s = await getOrCreateSettings();
    if (retentionDays !== undefined) s.retentionDays = Number(retentionDays);
    if (summarizeBeforeDelete !== undefined) s.summarizeBeforeDelete = Boolean(summarizeBeforeDelete);
    if (autoRunEnabled !== undefined) s.autoRunEnabled = Boolean(autoRunEnabled);
    await s.save();
    res.json({ retentionDays: s.retentionDays, summarizeBeforeDelete: s.summarizeBeforeDelete, autoRunEnabled: s.autoRunEnabled });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/retention/stats
router.get("/retention/stats", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const s = await getOrCreateSettings();
    const cutoff = new Date(Date.now() - s.retentionDays * 24 * 60 * 60 * 1000);

    const [eligible, alreadySummarized, totalMessages] = await Promise.all([
      ClosedConversation.count({ where: { closedAt: { [Op.lt]: cutoff }, messagesDeleted: false } }),
      ClosedConversation.count({ where: { messagesDeleted: true } }),
      ClosedMessage.count(),
    ]);

    const total = await ClosedConversation.count();

    res.json({
      retentionDays: s.retentionDays,
      summarizeBeforeDelete: s.summarizeBeforeDelete,
      eligible,
      alreadySummarized,
      totalTranscripts: total,
      totalRawMessages: totalMessages,
      cutoffDate: cutoff.toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/retention/run  — process up to 50 conversations per call
router.post("/retention/run", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const s = await getOrCreateSettings();
    const cutoff = new Date(Date.now() - s.retentionDays * 24 * 60 * 60 * 1000);

    const conversations = await ClosedConversation.findAll({
      where: { closedAt: { [Op.lt]: cutoff }, messagesDeleted: false },
      limit: 50,
      order: [["closedAt", "ASC"]],
    });

    let processed = 0;
    let summarized = 0;
    let errors = 0;

    for (const conv of conversations) {
      try {
        let summary: string | null = null;
        if (s.summarizeBeforeDelete) {
          const messages = await ClosedMessage.findAll({
            where: { closedConversationId: conv.id },
            order: [["originalCreatedAt", "ASC"]],
            attributes: ["sender", "content"],
          });
          if (messages.length > 0) {
            summary = await summarizeMessages(
              messages.map((m) => ({ sender: m.sender, content: m.content })),
              conv.customerName
            );
            summarized++;
          }
        }

        // Delete raw messages
        await ClosedMessage.destroy({ where: { closedConversationId: conv.id } });

        // Save summary & flag
        conv.summary = summary;
        conv.messagesDeleted = true;
        await conv.save();
        processed++;
      } catch (innerErr) {
        console.error(`Failed to process closed conversation ${conv.id}:`, innerErr);
        errors++;
      }
    }

    res.json({
      processed,
      summarized,
      errors,
      remaining: conversations.length === 50 ? "more" : 0,
      message: processed === 0
        ? "No transcripts eligible for retention processing."
        : `Processed ${processed} transcript(s)${summarized > 0 ? `, summarized ${summarized}` : ""}. ${errors > 0 ? `${errors} error(s).` : ""}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
