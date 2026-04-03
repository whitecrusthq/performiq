import { Router } from "express";
import { Op, fn, col, literal } from "sequelize";
import { Conversation, Customer, Message, Agent, Campaign } from "../models/index.js";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.get("/dashboard", requireAuth, async (req: AuthRequest, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalOpen, totalPending, resolvedToday, totalCustomers, agentsOnline] = await Promise.all([
      Conversation.count({ where: { status: "open" } }),
      Conversation.count({ where: { status: "pending" } }),
      Conversation.count({ where: { status: "resolved", updatedAt: { [Op.gte]: today } } }),
      Customer.count(),
      Agent.count({ where: { isActive: true } }),
    ]);

    const totalClosed = resolvedToday;
    const resolutionRate = totalClosed + totalOpen > 0
      ? Math.round((totalClosed / (totalClosed + totalOpen + totalPending)) * 100)
      : 0;

    const channelCounts = await Conversation.findAll({
      attributes: ["channel", [fn("COUNT", col("id")), "count"]],
      group: ["channel"],
      raw: true,
    }) as unknown as Array<{ channel: string; count: string }>;

    const recentActivity = await Conversation.findAll({
      where: { status: { [Op.in]: ["open", "pending"] } },
      include: [{ model: Customer, as: "customer", attributes: ["name", "channel"] }],
      order: [["lastMessageAt", "DESC"], ["createdAt", "DESC"]],
      limit: 10,
    });

    const [campaignChannelCounts, totalCampaigns, sentCampaigns] = await Promise.all([
      Campaign.findAll({
        attributes: ["channel", [fn("COUNT", col("id")), "count"]],
        group: ["channel"],
        raw: true,
      }) as unknown as Promise<Array<{ channel: string; count: string }>>,
      Campaign.count(),
      Campaign.count({ where: { status: "sent" } }),
    ]);

    const recentCampaigns = await Campaign.findAll({
      order: [["createdAt", "DESC"]],
      limit: 5,
    });

    res.json({
      kpis: {
        openConversations: totalOpen,
        pendingConversations: totalPending,
        resolvedToday,
        totalCustomers,
        agentsOnline,
        resolutionRate,
        avgResponseMinutes: 8,
        csatScore: 4.6,
      },
      channelBreakdown: channelCounts.map((r) => ({ channel: r.channel, count: parseInt(r.count) })),
      recentActivity,
      campaigns: {
        total: totalCampaigns,
        sent: sentCampaigns,
        byChannel: campaignChannelCounts.map((r) => ({ channel: r.channel, count: parseInt(r.count) })),
        recent: recentCampaigns,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
