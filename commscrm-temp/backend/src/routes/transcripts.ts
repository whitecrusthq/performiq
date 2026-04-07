import { Router } from "express";
import { Op, fn, col, literal } from "sequelize";
import { requireAuth } from "../middlewares/auth.js";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { Agent } from "../models/Agent.js";
import { Customer } from "../models/Customer.js";
import { Feedback } from "../models/Feedback.js";
import { AgentKpi } from "../models/AgentKpi.js";

const router = Router();

// ── GET /api/transcripts ────────────────────────────────────────────────────
router.get("/transcripts", requireAuth, async (req, res) => {
  try {
    const { search, agentId, channel, status, page = "1", limit = "30" } = req.query as Record<string, string>;
    const pageNum = parseInt(page) || 1;
    const limitNum = Math.min(parseInt(limit) || 30, 100);
    const offset = (pageNum - 1) * limitNum;

    const convWhere: Record<string, unknown> = {};
    if (agentId && agentId !== "all") convWhere.assignedAgentId = parseInt(agentId);
    if (channel && channel !== "all") convWhere.channel = channel;
    if (status && status !== "all") convWhere.status = status;

    const customerWhere: Record<string, unknown> = {};
    if (search) {
      customerWhere[Op.or as symbol] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows: conversations } = await Conversation.findAndCountAll({
      where: convWhere,
      include: [
        { model: Customer, as: "customer", where: search ? customerWhere : undefined, required: !!search, attributes: ["id", "name", "phone", "email"] },
        { model: Agent, as: "assignedAgent", attributes: ["id", "name", "email", "role"], required: false },
      ],
      order: [["lastMessageAt", "DESC NULLS LAST"]],
      limit: limitNum,
      offset,
    });

    const convIds = conversations.map((c) => c.id);
    const msgCounts: Array<{ conversationId: number; total: number; agentCount: number; botCount: number; customerCount: number }> = [];
    if (convIds.length > 0) {
      const counts = await Message.findAll({
        where: { conversationId: { [Op.in]: convIds } },
        attributes: [
          "conversationId",
          [fn("COUNT", col("id")), "total"],
          [fn("SUM", literal("CASE WHEN sender = 'agent' THEN 1 ELSE 0 END")), "agentCount"],
          [fn("SUM", literal("CASE WHEN sender = 'bot' THEN 1 ELSE 0 END")), "botCount"],
          [fn("SUM", literal("CASE WHEN sender = 'customer' THEN 1 ELSE 0 END")), "customerCount"],
        ],
        group: ["conversationId"],
        raw: true,
      }) as unknown as Array<{ conversationId: number; total: string; agentCount: string; botCount: string; customerCount: string }>;
      counts.forEach((c) =>
        msgCounts.push({
          conversationId: c.conversationId,
          total: parseInt(c.total) || 0,
          agentCount: parseInt(c.agentCount) || 0,
          botCount: parseInt(c.botCount) || 0,
          customerCount: parseInt(c.customerCount) || 0,
        })
      );
    }

    const countMap = new Map(msgCounts.map((m) => [m.conversationId, m]));
    const data = conversations.map((conv) => {
      const plain = conv.toJSON() as Record<string, unknown>;
      const mc = countMap.get(conv.id) ?? { total: 0, agentCount: 0, botCount: 0, customerCount: 0 };
      return { ...plain, messageCounts: mc };
    });

    res.json({ conversations: data, total: count, page: pageNum, totalPages: Math.ceil(count / limitNum) });
  } catch (err) {
    console.error("transcripts list error", err);
    res.status(500).json({ error: "Failed to fetch transcripts" });
  }
});

// ── GET /api/transcripts/:id/messages ──────────────────────────────────────
router.get("/transcripts/:id/messages", requireAuth, async (req, res) => {
  try {
    const conv = await Conversation.findByPk(req.params.id, {
      include: [
        { model: Customer, as: "customer", attributes: ["id", "name", "phone", "email"] },
        { model: Agent, as: "assignedAgent", attributes: ["id", "name", "email", "role"], required: false },
      ],
    });
    if (!conv) return res.status(404).json({ error: "Conversation not found" });

    const messages = await Message.findAll({
      where: { conversationId: conv.id },
      order: [["createdAt", "ASC"]],
    });

    const feedback = await Feedback.findOne({ where: { conversationId: conv.id } });

    let avgResponseMs: number | null = null;
    const allMsgs = messages.map((m) => m.toJSON() as { sender: string; createdAt: string });
    const responseTimes: number[] = [];
    for (let i = 1; i < allMsgs.length; i++) {
      if (allMsgs[i - 1].sender === "customer" && (allMsgs[i].sender === "agent" || allMsgs[i].sender === "bot")) {
        responseTimes.push(new Date(allMsgs[i].createdAt).getTime() - new Date(allMsgs[i - 1].createdAt).getTime());
      }
    }
    if (responseTimes.length > 0) {
      avgResponseMs = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    }

    res.json({ conversation: conv, messages, feedback, avgResponseMs });
  } catch (err) {
    console.error("transcript messages error", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// ── GET /api/transcripts/agent-stats ───────────────────────────────────────
router.get("/transcripts/agent-stats", requireAuth, async (req, res) => {
  try {
    const { period = "weekly" } = req.query as { period?: string };
    const cutoff = new Date();
    if (period === "monthly") cutoff.setDate(cutoff.getDate() - 30);
    else if (period === "daily") cutoff.setHours(cutoff.getHours() - 24);
    else cutoff.setDate(cutoff.getDate() - 7);

    const agents = await Agent.findAll({ where: { isActive: true }, attributes: ["id", "name", "email", "role", "avatar"] });

    const stats = await Promise.all(
      agents.map(async (agent) => {
        const conversations = await Conversation.findAll({
          where: { assignedAgentId: agent.id, createdAt: { [Op.gte]: cutoff } },
          attributes: ["id", "status", "createdAt", "updatedAt", "reopenCount"],
        });

        const convIds = conversations.map((c) => c.id);
        const totalConversations = convIds.length;
        const resolvedConversations = conversations.filter((c) => c.status === "resolved").length;
        const resolutionRate = totalConversations > 0 ? (resolvedConversations / totalConversations) * 100 : 0;

        // Reopen rate — conversations that were reopened at least once
        const reopenedCount = conversations.filter((c) => (c.reopenCount ?? 0) > 0).length;
        const reopenableBase = resolvedConversations + reopenedCount;
        const reopenRate = reopenableBase > 0 ? (reopenedCount / reopenableBase) * 100 : 0;

        // Avg handle time — minutes from createdAt to updatedAt for resolved conversations
        const resolvedConvs = conversations.filter((c) => c.status === "resolved");
        let avgHandleTimeMins: number | null = null;
        if (resolvedConvs.length > 0) {
          const handleTimes = resolvedConvs.map((c) => {
            const created = new Date(c.createdAt!).getTime();
            const updated = new Date(c.updatedAt!).getTime();
            return (updated - created) / 60000;
          });
          avgHandleTimeMins = handleTimes.reduce((a, b) => a + b, 0) / handleTimes.length;
        }

        // Messages sent by agent
        const agentMessages = convIds.length
          ? await Message.count({ where: { conversationId: { [Op.in]: convIds }, sender: "agent" } })
          : 0;

        // Avg first response time in minutes
        let avgResponseTimeMins: number | null = null;
        if (convIds.length > 0) {
          const msgs = await Message.findAll({
            where: { conversationId: { [Op.in]: convIds } },
            order: [["conversationId", "ASC"], ["createdAt", "ASC"]],
            attributes: ["conversationId", "sender", "createdAt"],
          });
          const responseTimes: number[] = [];
          const grouped = new Map<number, typeof msgs>();
          msgs.forEach((m) => {
            if (!grouped.has(m.conversationId)) grouped.set(m.conversationId, []);
            grouped.get(m.conversationId)!.push(m);
          });
          grouped.forEach((threadMsgs) => {
            for (let i = 1; i < threadMsgs.length; i++) {
              if (threadMsgs[i - 1].sender === "customer" && threadMsgs[i].sender === "agent") {
                responseTimes.push(
                  (new Date(threadMsgs[i].createdAt).getTime() - new Date(threadMsgs[i - 1].createdAt).getTime()) / 60000
                );
              }
            }
          });
          if (responseTimes.length > 0) avgResponseTimeMins = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        }

        // CSAT
        const feedbackRows = await Feedback.findAll({
          where: { agentId: agent.id, createdAt: { [Op.gte]: cutoff } },
          attributes: ["rating"],
        });
        const csatScore =
          feedbackRows.length > 0
            ? feedbackRows.reduce((sum, f) => sum + f.rating, 0) / feedbackRows.length
            : null;

        // KPI targets — daily view reuses weekly targets
        const kpiPeriod = period === "daily" ? "weekly" : period;
        const kpiTarget = await AgentKpi.findOne({ where: { agentId: agent.id, period: kpiPeriod } });

        return {
          agent: agent.toJSON(),
          period,
          totalConversations,
          resolvedConversations,
          reopenedCount,
          resolutionRate: Math.round(resolutionRate * 10) / 10,
          reopenRate: Math.round(reopenRate * 10) / 10,
          avgHandleTimeMins: avgHandleTimeMins !== null ? Math.round(avgHandleTimeMins * 10) / 10 : null,
          agentMessages,
          avgResponseTimeMins: avgResponseTimeMins !== null ? Math.round(avgResponseTimeMins * 10) / 10 : null,
          csatScore: csatScore !== null ? Math.round(csatScore * 10) / 10 : null,
          csatCount: feedbackRows.length,
          targets: kpiTarget
            ? {
                conversations: kpiTarget.targetConversations,
                responseTimeMins: kpiTarget.targetResponseTimeMins,
                resolutionRate: kpiTarget.targetResolutionRate,
                csatScore: kpiTarget.targetCsatScore,
                reopenRate: kpiTarget.targetReopenRate,
                handleTimeMins: kpiTarget.targetHandleTimeMins,
              }
            : null,
        };
      })
    );

    res.json({ stats, period });
  } catch (err) {
    console.error("agent-stats error", err);
    res.status(500).json({ error: "Failed to compute agent stats" });
  }
});

// ── PUT /api/transcripts/kpi-targets/:agentId ──────────────────────────────
router.put("/transcripts/kpi-targets/:agentId", requireAuth, async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const {
      period = "weekly",
      targetConversations,
      targetResponseTimeMins,
      targetResolutionRate,
      targetCsatScore,
      targetReopenRate,
      targetHandleTimeMins,
    } = req.body as {
      period?: "weekly" | "monthly";
      targetConversations?: number;
      targetResponseTimeMins?: number;
      targetResolutionRate?: number;
      targetCsatScore?: number;
      targetReopenRate?: number;
      targetHandleTimeMins?: number;
    };

    const [record, created] = await AgentKpi.findOrCreate({
      where: { agentId, period },
      defaults: {
        agentId,
        period,
        targetConversations: null,
        targetResponseTimeMins: null,
        targetResolutionRate: null,
        targetCsatScore: null,
        targetReopenRate: null,
        targetHandleTimeMins: null,
      },
    });

    const updates: Partial<typeof record.dataValues> = {};
    if (targetConversations !== undefined) updates.targetConversations = targetConversations;
    else if (!created) updates.targetConversations = record.targetConversations;

    if (targetResponseTimeMins !== undefined) updates.targetResponseTimeMins = targetResponseTimeMins;
    else if (!created) updates.targetResponseTimeMins = record.targetResponseTimeMins;

    if (targetResolutionRate !== undefined) updates.targetResolutionRate = targetResolutionRate;
    else if (!created) updates.targetResolutionRate = record.targetResolutionRate;

    if (targetCsatScore !== undefined) updates.targetCsatScore = targetCsatScore;
    else if (!created) updates.targetCsatScore = record.targetCsatScore;

    if (targetReopenRate !== undefined) updates.targetReopenRate = targetReopenRate;
    else if (!created) updates.targetReopenRate = record.targetReopenRate;

    if (targetHandleTimeMins !== undefined) updates.targetHandleTimeMins = targetHandleTimeMins;
    else if (!created) updates.targetHandleTimeMins = record.targetHandleTimeMins;

    await record.update(updates);
    res.json(record);
  } catch (err) {
    console.error("kpi-targets error", err);
    res.status(500).json({ error: "Failed to save KPI targets" });
  }
});

// ── POST /api/transcripts/kpi-targets/best-practice ────────────────────────
// Apply industry-standard KPI defaults to all agents for the given period
router.post("/transcripts/kpi-targets/best-practice", requireAuth, async (req, res) => {
  try {
    const { period = "weekly" } = req.body as { period?: "weekly" | "monthly" };

    const bestPractice = {
      weekly: {
        targetConversations: 50,
        targetResponseTimeMins: 5,
        targetResolutionRate: 85,
        targetCsatScore: 4.2,
        targetReopenRate: 5,
        targetHandleTimeMins: 45,
      },
      monthly: {
        targetConversations: 200,
        targetResponseTimeMins: 5,
        targetResolutionRate: 85,
        targetCsatScore: 4.2,
        targetReopenRate: 5,
        targetHandleTimeMins: 45,
      },
    };

    const defaults = bestPractice[period as "weekly" | "monthly"] ?? bestPractice.weekly;
    const agents = await Agent.findAll({ where: { isActive: true }, attributes: ["id"] });

    await Promise.all(
      agents.map(async (agent) => {
        const [record, created] = await AgentKpi.findOrCreate({
          where: { agentId: agent.id, period },
          defaults: { agentId: agent.id, period, ...defaults },
        });
        if (!created) await record.update(defaults);
      })
    );

    res.json({ applied: agents.length, period, defaults });
  } catch (err) {
    console.error("best-practice kpi error", err);
    res.status(500).json({ error: "Failed to apply best-practice KPI defaults" });
  }
});

export default router;
