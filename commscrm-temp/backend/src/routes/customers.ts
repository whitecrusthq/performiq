import { Router } from "express";
import { Op, fn, col, literal } from "sequelize";
import { Customer, Conversation } from "../models/index.js";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.get("/customers", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { search, channel, page = "1", limit = "20" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where: Record<string, unknown> = {};
    if (channel) where.channel = channel;
    if (search) {
      where[Op.or as unknown as string] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Customer.findAndCountAll({
      where,
      order: [["lastSeen", "DESC NULLS LAST"], ["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset,
    });

    res.json({ total: count, page: parseInt(page), customers: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/customers/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    const conversations = await Conversation.findAll({
      where: { customerId: req.params.id },
      order: [["createdAt", "DESC"]],
      limit: 20,
      attributes: ["id", "channel", "status", "createdAt", "lastMessageAt"],
    });

    res.json({ ...customer.toJSON(), conversations });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/customers", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { name, email, phone, channel, tags, notes } = req.body;
    if (!name || !channel) {
      res.status(400).json({ error: "Name and channel are required" });
      return;
    }
    const customer = await Customer.create({ name, email, phone, channel, tags: tags ?? [], notes });
    res.status(201).json(customer);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

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

router.get("/customers/analytics/summary", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { since, until, days } = parseDateRange(req.query as Record<string, unknown>);
    const channel = req.query.channel as string | undefined;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date();
    monthStart.setDate(monthStart.getDate() - 30);
    monthStart.setHours(0, 0, 0, 0);
    const prevMonthStart = new Date();
    prevMonthStart.setDate(prevMonthStart.getDate() - 60);
    prevMonthStart.setHours(0, 0, 0, 0);

    const channelFilter = channel && channel !== "all" ? { channel } : {};

    const [totalContacts, newToday, newThisWeek, newThisMonth, newPrevMonth] = await Promise.all([
      Customer.count({ where: channelFilter }),
      Customer.count({ where: { ...channelFilter, createdAt: { [Op.gte]: todayStart } } }),
      Customer.count({ where: { ...channelFilter, createdAt: { [Op.gte]: weekStart } } }),
      Customer.count({ where: { ...channelFilter, createdAt: { [Op.gte]: monthStart } } }),
      Customer.count({ where: { ...channelFilter, createdAt: { [Op.between]: [prevMonthStart, monthStart] } } }),
    ]);

    const monthlyGrowthPct = newPrevMonth > 0
      ? Math.round(((newThisMonth - newPrevMonth) / newPrevMonth) * 100)
      : newThisMonth > 0 ? 100 : 0;

    // Daily new contacts trend
    const newContactsTrend: Array<{ date: string; count: number }> = [];
    const totalGrowthTrend: Array<{ date: string; total: number }> = [];

    // Count total before window
    const baseTotal = await Customer.count({ where: { ...channelFilter, createdAt: { [Op.lt]: since } } });
    let runningTotal = baseTotal;

    // Condense to weekly buckets when range > 90 days
    const bucketSize = days > 90 ? 7 : 1;
    let cursor = new Date(since);
    while (cursor <= until) {
      const bucketEnd = new Date(cursor);
      bucketEnd.setDate(bucketEnd.getDate() + bucketSize);
      if (bucketEnd > until) bucketEnd.setTime(until.getTime());

      const dayCount = await Customer.count({ where: { ...channelFilter, createdAt: { [Op.between]: [cursor, bucketEnd] } } });
      runningTotal += dayCount;

      newContactsTrend.push({ date: cursor.toLocaleDateString("en-US", { month: "short", day: "numeric" }), count: dayCount });
      totalGrowthTrend.push({ date: cursor.toLocaleDateString("en-US", { month: "short", day: "numeric" }), total: runningTotal });

      cursor.setDate(cursor.getDate() + bucketSize);
    }

    // Per-platform stats
    const platformNames = ["whatsapp", "facebook", "instagram"] as const;
    const contactsByPlatform = await Promise.all(
      platformNames.map(async (ch) => {
        const count = await Customer.count({ where: { channel: ch } });
        const pct = totalContacts > 0 ? Math.round((count / totalContacts) * 100) : 0;
        return { channel: ch, count, percentage: pct };
      })
    );

    // Growth summary stats
    const activeInPeriod = await Conversation.count({
      where: { updatedAt: { [Op.between]: [since, until] } },
      distinct: true,
      col: "customer_id",
    });

    const topPlatform = [...contactsByPlatform].sort((a, b) => b.count - a.count)[0];

    res.json({
      summary: { totalContacts, newToday, newThisWeek, newThisMonth, monthlyGrowthPct },
      newContactsTrend,
      totalGrowthTrend,
      contactsByPlatform,
      growthSummary: {
        activeInPeriod,
        topPlatform: topPlatform?.channel ?? "whatsapp",
        topPlatformCount: topPlatform?.count ?? 0,
        avgConversations: totalContacts > 0 ? parseFloat((activeInPeriod / totalContacts).toFixed(1)) : 0,
      },
      days,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/customers/bulk — import multiple customers at once
router.post("/customers/bulk", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { customers: rows } = req.body as { customers: Array<{ name: string; email?: string; phone?: string; channel?: string; tags?: string[]; notes?: string }> };
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: "No customer records provided" });
      return;
    }
    if (rows.length > 1000) {
      res.status(400).json({ error: "Maximum 1000 customers per import" });
      return;
    }

    const validChannels = ["whatsapp", "facebook", "instagram"];
    const created: unknown[] = [];
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.name?.trim()) {
        errors.push({ row: i + 1, error: "Name is required" });
        continue;
      }
      const channel = validChannels.includes(r.channel ?? "") ? r.channel : "whatsapp";
      try {
        const c = await Customer.create({
          name: r.name.trim(),
          email: r.email?.trim() || null,
          phone: r.phone?.trim() || null,
          channel: channel as "whatsapp" | "facebook" | "instagram",
          tags: Array.isArray(r.tags) ? r.tags : (r.tags ? String(r.tags).split(",").map((t: string) => t.trim()).filter(Boolean) : []),
          notes: r.notes?.trim() || null,
        });
        created.push(c.toJSON());
      } catch (e) {
        errors.push({ row: i + 1, error: "Failed to create" });
      }
    }

    res.status(201).json({ created: created.length, errors, total: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/customers/export — fetch all customers for export (up to 5000)
router.get("/customers/export", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { ids, channel } = req.query as Record<string, string>;
    const where: Record<string, unknown> = {};
    if (channel && channel !== "all") where.channel = channel;
    if (ids) {
      const idArr = ids.split(",").map((id) => parseInt(id)).filter(Boolean);
      where.id = { [Op.in]: idArr };
    }
    const rows = await Customer.findAll({ where, order: [["createdAt", "DESC"]], limit: 5000 });
    res.json({ customers: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/customers/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    const { name, email, phone, tags, notes } = req.body;
    if (name !== undefined) customer.name = name;
    if (email !== undefined) customer.email = email;
    if (phone !== undefined) customer.phone = phone;
    if (tags !== undefined) customer.tags = tags;
    if (notes !== undefined) customer.notes = notes;
    await customer.save();
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
