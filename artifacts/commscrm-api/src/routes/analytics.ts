import { Router } from "express";
import { Op, fn, col, literal } from "sequelize";
import { Conversation, Agent, Message } from "../models/index.js";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";

const router = Router();

function parseDateRange(query: Record<string, unknown>): { since: Date; until: Date; days: number } {
  const until = new Date();
  until.setHours(23, 59, 59, 999);

  if (query.startDate && query.endDate) {
    const since = new Date(query.startDate as string);
    since.setHours(0, 0, 0, 0);
    const end = new Date(query.endDate as string);
    end.setHours(23, 59, 59, 999);
    const days = Math.max(1, Math.ceil((end.getTime() - since.getTime()) / 86400000));
    return { since, until: end, days };
  }

  const days = Math.max(1, parseInt((query.days as string) ?? "30"));
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);
  return { since, until, days };
}

router.get("/analytics", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { since, until, days } = parseDateRange(req.query as Record<string, unknown>);

    const dateFilter = { [Op.between]: [since, until] };

    // ── Summary counts ────────────────────────────────────────────────────
    const [totalReceived, totalSent, aiMessages] = await Promise.all([
      Message.count({ where: { sender: "customer", createdAt: dateFilter } }),
      Message.count({ where: { sender: { [Op.in]: ["agent", "bot"] }, createdAt: dateFilter } }),
      Message.count({ where: { sender: "bot", createdAt: dateFilter } }),
    ]);

    // ── Top channel by conversation count ─────────────────────────────────
    const channelVolumes = await Conversation.findAll({
      attributes: ["channel", [fn("COUNT", col("id")), "cnt"]],
      group: ["channel"],
      order: [[literal("cnt"), "DESC"]],
      raw: true,
    }) as unknown as Array<{ channel: string; cnt: string }>;

    const topChannelRow = channelVolumes[0] ?? { channel: "whatsapp", cnt: "0" };

    // ── Daily trend (received vs sent) ────────────────────────────────────
    // Condense to weekly buckets when range > 90 days for readability
    const bucketSize = days > 90 ? 7 : 1;
    const dailyTrend: Array<{ date: string; received: number; sent: number }> = [];
    let cursor = new Date(since);
    while (cursor <= until) {
      const bucketEnd = new Date(cursor);
      bucketEnd.setDate(bucketEnd.getDate() + bucketSize);
      if (bucketEnd > until) bucketEnd.setTime(until.getTime());

      const [recv, sent] = await Promise.all([
        Message.count({ where: { sender: "customer", createdAt: { [Op.between]: [cursor, bucketEnd] } } }),
        Message.count({ where: { sender: { [Op.in]: ["agent", "bot"] }, createdAt: { [Op.between]: [cursor, bucketEnd] } } }),
      ]);

      dailyTrend.push({
        date: cursor.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        received: recv,
        sent,
      });

      cursor.setDate(cursor.getDate() + bucketSize);
    }

    // ── Per-channel stats ─────────────────────────────────────────────────
    const channelNames = ["whatsapp", "facebook", "instagram"] as const;
    const channelStats = await Promise.all(
      channelNames.map(async (channel) => {
        const convIds = (
          await Conversation.findAll({ where: { channel }, attributes: ["id"], raw: true })
        ).map((c: unknown) => (c as { id: number }).id);

        if (convIds.length === 0) {
          return { channel, received: 0, sent: 0, aiMessages: 0 };
        }

        const [received, sent, ai] = await Promise.all([
          Message.count({ where: { conversationId: { [Op.in]: convIds }, sender: "customer", createdAt: dateFilter } }),
          Message.count({ where: { conversationId: { [Op.in]: convIds }, sender: { [Op.in]: ["agent", "bot"] }, createdAt: dateFilter } }),
          Message.count({ where: { conversationId: { [Op.in]: convIds }, sender: "bot", createdAt: dateFilter } }),
        ]);

        return { channel, received, sent, aiMessages: ai };
      })
    );

    // ── Agent performance (kept for backward compat) ──────────────────────
    const agentPerformance = await Agent.findAll({
      attributes: ["id", "name", "avatar", "resolvedToday", "rating", "activeConversations"],
      order: [["resolvedToday", "DESC"]],
      limit: 10,
    });

    res.json({
      summary: {
        totalReceived,
        totalSent,
        aiMessages,
        aiPercentage: totalSent > 0 ? Math.round((aiMessages / totalSent) * 100) : 0,
        topChannel: topChannelRow.channel,
        topChannelCount: parseInt(topChannelRow.cnt),
      },
      dailyTrend,
      channelStats,
      agentPerformance,
      days,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
