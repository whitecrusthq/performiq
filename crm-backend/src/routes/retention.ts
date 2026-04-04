import { Router } from "express";
import { Op } from "sequelize";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import { RetentionSettings } from "../models/RetentionSettings.js";
import { ClosedConversation } from "../models/ClosedConversation.js";
import { ClosedMessage } from "../models/ClosedMessage.js";
import { Feedback } from "../models/Feedback.js";
import { getAiSettings, generateText } from "../lib/ai-provider.js";

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getOrCreateSettings() {
  let s = await RetentionSettings.findOne({ order: [["id", "ASC"]] });
  if (!s) {
    s = await RetentionSettings.create({
      retentionDays: 90,
      summarizeBeforeDelete: true,
      autoRunEnabled: false,
      action: "archive",
      channelFilter: '["all"]',
      includeClosedMessages: true,
      includeFeedback: false,
      minMessageCount: 0,
    });
  }
  return s;
}

function parseChannels(channelFilter: string): string[] | null {
  try {
    const arr: string[] = JSON.parse(channelFilter);
    if (arr.includes("all")) return null; // null = no filter
    return arr;
  } catch {
    return null;
  }
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
    const customerMsgs = messages.filter((m) => m.sender === "customer").length;
    const agentMsgs = messages.filter((m) => m.sender === "agent").length;
    return `Conversation with ${customerName} — ${messages.length} messages (${customerMsgs} from customer, ${agentMsgs} from agent/bot). Full transcript archived per retention policy.`;
  }
}

function settingsToJson(s: RetentionSettings) {
  return {
    retentionDays: s.retentionDays,
    summarizeBeforeDelete: s.summarizeBeforeDelete,
    autoRunEnabled: s.autoRunEnabled,
    action: s.action,
    channelFilter: (() => { try { return JSON.parse(s.channelFilter); } catch { return ["all"]; } })(),
    includeClosedMessages: s.includeClosedMessages,
    includeFeedback: s.includeFeedback,
    minMessageCount: s.minMessageCount,
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/retention/settings
router.get("/retention/settings", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const s = await getOrCreateSettings();
    res.json(settingsToJson(s));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/retention/settings
router.put("/retention/settings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      retentionDays, summarizeBeforeDelete, autoRunEnabled,
      action, channelFilter, includeClosedMessages, includeFeedback, minMessageCount,
    } = req.body;

    const s = await getOrCreateSettings();
    if (retentionDays !== undefined) s.retentionDays = Number(retentionDays);
    if (summarizeBeforeDelete !== undefined) s.summarizeBeforeDelete = Boolean(summarizeBeforeDelete);
    if (autoRunEnabled !== undefined) s.autoRunEnabled = Boolean(autoRunEnabled);
    if (action !== undefined) s.action = action;
    if (channelFilter !== undefined) s.channelFilter = Array.isArray(channelFilter) ? JSON.stringify(channelFilter) : channelFilter;
    if (includeClosedMessages !== undefined) s.includeClosedMessages = Boolean(includeClosedMessages);
    if (includeFeedback !== undefined) s.includeFeedback = Boolean(includeFeedback);
    if (minMessageCount !== undefined) s.minMessageCount = Number(minMessageCount);

    await s.save();
    res.json(settingsToJson(s));
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
    const channels = parseChannels(s.channelFilter);

    // Build channel where clause
    const channelWhere = channels ? { channel: { [Op.in]: channels } } : {};

    const [eligible, alreadySummarized, totalMessages, total] = await Promise.all([
      ClosedConversation.count({
        where: { closedAt: { [Op.lt]: cutoff }, messagesDeleted: false, ...channelWhere },
      }),
      ClosedConversation.count({ where: { messagesDeleted: true } }),
      ClosedMessage.count(),
      ClosedConversation.count(),
    ]);

    // Per-channel breakdown
    const channelBreakdown: Record<string, number> = {};
    for (const ch of ["whatsapp", "facebook", "instagram"]) {
      channelBreakdown[ch] = await ClosedConversation.count({
        where: { closedAt: { [Op.lt]: cutoff }, messagesDeleted: false, channel: ch },
      });
    }

    // Feedback stats (if applicable)
    let feedbackEligible = 0;
    let totalFeedback = 0;
    try {
      totalFeedback = await Feedback.count();
      const feedbackCutoff = new Date(Date.now() - s.retentionDays * 24 * 60 * 60 * 1000);
      feedbackEligible = await Feedback.count({ where: { createdAt: { [Op.lt]: feedbackCutoff } } });
    } catch {
      // Feedback table may not exist or may have different schema
    }

    res.json({
      retentionDays: s.retentionDays,
      summarizeBeforeDelete: s.summarizeBeforeDelete,
      action: s.action,
      eligible,
      alreadySummarized,
      totalTranscripts: total,
      totalRawMessages: totalMessages,
      cutoffDate: cutoff.toISOString(),
      channelBreakdown,
      feedbackEligible,
      totalFeedback,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/retention/preview — dry-run: shows what would be affected
router.post("/retention/preview", requireAuth, async (req: AuthRequest, res) => {
  try {
    const s = await getOrCreateSettings();
    const cutoff = new Date(Date.now() - s.retentionDays * 24 * 60 * 60 * 1000);
    const channels = parseChannels(s.channelFilter);
    const channelWhere = channels ? { channel: { [Op.in]: channels } } : {};

    const baseWhere: Record<string, unknown> = {
      closedAt: { [Op.lt]: cutoff },
      messagesDeleted: false,
      ...channelWhere,
    };

    if (s.minMessageCount > 0) {
      // Count conversations that have at least minMessageCount messages
      // We'll do this in JS since it requires a join-count filter
    }

    const conversations = await ClosedConversation.findAll({
      where: baseWhere,
      limit: 200,
      order: [["closedAt", "ASC"]],
      attributes: ["id", "customerName", "channel", "closedAt"],
    });

    // Filter by min message count if set
    const eligible: Array<{ id: number; customerName: string; channel: string; closedAt: Date; messageCount: number }> = [];
    for (const conv of conversations) {
      const msgCount = await ClosedMessage.count({ where: { closedConversationId: conv.id } });
      if (msgCount >= s.minMessageCount) {
        eligible.push({
          id: conv.id,
          customerName: conv.customerName,
          channel: conv.channel as string,
          closedAt: conv.closedAt,
          messageCount: msgCount,
        });
      }
    }

    res.json({
      eligible: eligible.length,
      action: s.action,
      willSummarize: s.action === "archive" && s.summarizeBeforeDelete,
      items: eligible.slice(0, 20), // Show first 20 as sample
      channelBreakdown: {
        whatsapp: eligible.filter((e) => e.channel === "whatsapp").length,
        facebook: eligible.filter((e) => e.channel === "facebook").length,
        instagram: eligible.filter((e) => e.channel === "instagram").length,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/retention/run — process up to 50 conversations per call
router.post("/retention/run", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const s = await getOrCreateSettings();
    const cutoff = new Date(Date.now() - s.retentionDays * 24 * 60 * 60 * 1000);
    const channels = parseChannels(s.channelFilter);
    const channelWhere = channels ? { channel: { [Op.in]: channels } } : {};

    const conversations = await ClosedConversation.findAll({
      where: { closedAt: { [Op.lt]: cutoff }, messagesDeleted: false, ...channelWhere },
      limit: 50,
      order: [["closedAt", "ASC"]],
    });

    let processed = 0;
    let summarized = 0;
    let fullyDeleted = 0;
    let errors = 0;

    for (const conv of conversations) {
      try {
        // Check min message count
        const msgCount = await ClosedMessage.count({ where: { closedConversationId: conv.id } });
        if (msgCount < s.minMessageCount) continue;

        if (s.action === "archive") {
          // Archive: optionally summarize, then delete raw messages but keep conversation record
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

          await ClosedMessage.destroy({ where: { closedConversationId: conv.id } });
          conv.summary = summary;
          conv.messagesDeleted = true;
          await conv.save();
        } else {
          // Full delete: remove messages AND the conversation record entirely
          await ClosedMessage.destroy({ where: { closedConversationId: conv.id } });
          await conv.destroy();
          fullyDeleted++;
        }

        processed++;
      } catch (innerErr) {
        console.error(`Failed to process closed conversation ${conv.id}:`, innerErr);
        errors++;
      }
    }

    // Handle feedback deletion if enabled
    let feedbackDeleted = 0;
    if (s.includeFeedback && s.action === "delete") {
      try {
        const feedbackCutoff = new Date(Date.now() - s.retentionDays * 24 * 60 * 60 * 1000);
        feedbackDeleted = await Feedback.destroy({ where: { createdAt: { [Op.lt]: feedbackCutoff } }, limit: 200 });
      } catch {
        // Feedback table may not support this operation
      }
    }

    const parts = [];
    if (processed > 0) {
      if (s.action === "archive") {
        parts.push(`Archived ${processed} transcript${processed !== 1 ? "s" : ""}${summarized > 0 ? ` (${summarized} AI-summarized)` : ""}`);
      } else {
        parts.push(`Fully deleted ${fullyDeleted} conversation record${fullyDeleted !== 1 ? "s" : ""}`);
      }
    }
    if (feedbackDeleted > 0) parts.push(`${feedbackDeleted} feedback record${feedbackDeleted !== 1 ? "s" : ""} deleted`);
    if (errors > 0) parts.push(`${errors} error(s)`);

    res.json({
      processed,
      summarized,
      fullyDeleted,
      feedbackDeleted,
      errors,
      remaining: conversations.length === 50 ? "more" : 0,
      message: processed === 0 && feedbackDeleted === 0
        ? "No records eligible for retention processing."
        : (parts.join(". ") + "."),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
