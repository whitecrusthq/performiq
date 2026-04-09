import { Router } from "express";
import { Op } from "sequelize";
import { PaymentTransaction } from "../models/PaymentTransaction.js";
import { PaymentLink } from "../models/PaymentLink.js";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import crypto from "crypto";

const router = Router();

// ── Seed demo transactions on first call ──────────────────────────────────────
async function seedDemoTransactions() {
  const count = await PaymentTransaction.count();
  if (count > 0) return;

  const providers = ["stripe", "paystack", "flutterwave", "paypal", "square"] as const;
  const statuses  = ["success", "success", "success", "failed", "pending", "refunded"] as const;
  const currencies = ["USD", "NGN", "GHS", "USD", "USD"] as const;
  const customers = [
    { name: "Amara Okonkwo",   email: "amara@example.com" },
    { name: "James Blackwell", email: "james@example.com" },
    { name: "Fatima Al-Rashid",email: "fatima@example.com" },
    { name: "Kweku Mensah",    email: "kweku@example.com" },
    { name: "Priya Sharma",    email: "priya@example.com" },
    { name: "Carlos Rivera",   email: "carlos@example.com" },
    { name: "Zainab Hassan",   email: "zainab@example.com" },
    { name: "David Kim",       email: "david@example.com" },
    { name: "Aisha Bello",     email: "aisha@example.com" },
    { name: "Tom Sullivan",    email: "tom@example.com" },
  ];

  const descriptions = [
    "Product subscription payment",
    "One-time purchase - Premium plan",
    "Invoice payment #INV-2024",
    "Service fee payment",
    "Order #ORD-8821 payment",
    "Annual membership renewal",
    "Consulting services payment",
    "SaaS plan upgrade",
    "Event ticket purchase",
    "Custom order payment",
  ];

  const now = new Date();
  const rows = [];
  for (let i = 0; i < 120; i++) {
    const provIdx   = i % providers.length;
    const statusIdx = Math.floor(Math.random() * statuses.length);
    const custIdx   = Math.floor(Math.random() * customers.length);
    const descIdx   = Math.floor(Math.random() * descriptions.length);
    const daysAgo   = Math.floor(Math.random() * 90);
    const baseAmount = [49, 99, 149, 199, 249, 299, 499, 999, 1499, 29][Math.floor(Math.random() * 10)];
    const multiplier = currencies[provIdx] === "NGN" ? 1600 : currencies[provIdx] === "GHS" ? 12 : 1;
    const paidAt = statuses[statusIdx] === "success" || statuses[statusIdx] === "refunded"
      ? new Date(now.getTime() - daysAgo * 86400000)
      : null;

    rows.push({
      provider:      providers[provIdx],
      txRef:         `TXN-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
      amount:        baseAmount * multiplier,
      currency:      currencies[provIdx],
      status:        statuses[statusIdx],
      customerName:  customers[custIdx].name,
      customerEmail: customers[custIdx].email,
      description:   descriptions[descIdx],
      paidAt,
      createdAt:     new Date(now.getTime() - daysAgo * 86400000 - 3600000),
      updatedAt:     new Date(now.getTime() - daysAgo * 86400000),
    });
  }
  await PaymentTransaction.bulkCreate(rows);
}

async function seedDemoLinks(origin: string) {
  const count = await PaymentLink.count();
  if (count > 0) return;
  const providers = ["stripe", "paystack", "flutterwave", "paypal", "square"] as const;
  const statuses  = ["active", "active", "paid", "expired", "cancelled"] as const;
  const now = new Date();

  const rows = [];
  for (let i = 0; i < 15; i++) {
    const token = crypto.randomBytes(12).toString("hex");
    const pIdx  = i % providers.length;
    const sIdx  = i % statuses.length;
    const daysAgo = Math.floor(Math.random() * 30);
    rows.push({
      provider:     providers[pIdx],
      title:        ["Premium Plan Upgrade", "Invoice #INV-20240" + (i + 1), "Subscription Renewal", "Product Order", "Service Fee"][i % 5],
      description:  "Payment link generated via CommsCRM",
      amount:       [49, 99, 149, 199, 29][i % 5],
      currency:     "USD" as const,
      status:       statuses[sIdx],
      linkToken:    token,
      linkUrl:      `${origin}/pay/${token}`,
      expiresAt:    statuses[sIdx] === "active" ? new Date(now.getTime() + 7 * 86400000) : new Date(now.getTime() - 2 * 86400000),
      paidAt:       statuses[sIdx] === "paid" ? new Date(now.getTime() - daysAgo * 86400000) : null,
      customerName: ["Amara Okonkwo", "James Blackwell", null, "Kweku Mensah", null][i % 5],
      customerEmail:["amara@example.com", "james@example.com", null, "kweku@example.com", null][i % 5],
      createdBy:    "sarah@commscrm.com",
      createdAt:    new Date(now.getTime() - daysAgo * 86400000),
      updatedAt:    new Date(now.getTime() - daysAgo * 86400000),
    });
  }
  await PaymentLink.bulkCreate(rows);
}

// ── Dashboard stats ──────────────────────────────────────────────────────────
router.get("/api/payments/stats", requireAuth, async (req, res) => {
  try {
    await seedDemoTransactions();

    const days = Number(req.query.days ?? 30);
    const since = new Date(Date.now() - days * 86400000);

    const all = await PaymentTransaction.findAll({
      where: { createdAt: { [Op.gte]: since } },
    });

    const success   = all.filter((t) => t.status === "success");
    const failed    = all.filter((t) => t.status === "failed");
    const pending   = all.filter((t) => t.status === "pending");
    const refunded  = all.filter((t) => t.status === "refunded");
    const totalRevenue = success.reduce((s, t) => s + (t.currency === "USD" ? t.amount : t.currency === "NGN" ? t.amount / 1600 : t.currency === "GHS" ? t.amount / 12 : t.amount), 0);
    const avgOrderValue = success.length ? totalRevenue / success.length : 0;

    const byProvider = ["stripe","paystack","flutterwave","paypal","square"].map((p) => {
      const pTx    = all.filter((t) => t.provider === p);
      const pOk    = pTx.filter((t) => t.status === "success");
      const pRev   = pOk.reduce((s, t) => s + (t.currency === "USD" ? t.amount : t.currency === "NGN" ? t.amount / 1600 : t.currency === "GHS" ? t.amount / 12 : t.amount), 0);
      return { provider: p, total: pTx.length, success: pOk.length, revenue: Math.round(pRev * 100) / 100 };
    }).filter((p) => p.total > 0);

    // daily trend for chart
    const trend: Record<string, { date: string; revenue: number; count: number }> = {};
    for (let d = days - 1; d >= 0; d--) {
      const dt = new Date(Date.now() - d * 86400000);
      const key = dt.toISOString().slice(0, 10);
      trend[key] = { date: key, revenue: 0, count: 0 };
    }
    for (const t of success) {
      const key = new Date(t.createdAt).toISOString().slice(0, 10);
      if (trend[key]) {
        const usdAmount = t.currency === "USD" ? t.amount : t.currency === "NGN" ? t.amount / 1600 : t.currency === "GHS" ? t.amount / 12 : t.amount;
        trend[key].revenue += usdAmount;
        trend[key].count   += 1;
      }
    }

    res.json({
      summary: {
        totalRevenue:   Math.round(totalRevenue * 100) / 100,
        totalTx:        all.length,
        successTx:      success.length,
        failedTx:       failed.length,
        pendingTx:      pending.length,
        refundedTx:     refunded.length,
        successRate:    all.length ? Math.round((success.length / all.length) * 1000) / 10 : 0,
        avgOrderValue:  Math.round(avgOrderValue * 100) / 100,
      },
      byProvider,
      trend: Object.values(trend).map((t) => ({ ...t, revenue: Math.round(t.revenue * 100) / 100 })),
      days,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Transactions list ─────────────────────────────────────────────────────────
router.get("/api/payments/transactions", requireAuth, async (req, res) => {
  try {
    await seedDemoTransactions();
    const { provider, status, search, page = "1", limit = "50", days } = req.query as Record<string, string>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (provider && provider !== "all") where.provider = provider;
    if (status && status !== "all") where.status = status;
    if (days) {
      where.createdAt = { [Op.gte]: new Date(Date.now() - Number(days) * 86400000) };
    }
    if (search) {
      where[Op.or] = [
        { customerName:  { [Op.iLike]: `%${search}%` } },
        { customerEmail: { [Op.iLike]: `%${search}%` } },
        { txRef:         { [Op.iLike]: `%${search}%` } },
        { description:   { [Op.iLike]: `%${search}%` } },
      ];
    }
    const offset = (Number(page) - 1) * Number(limit);
    const { count, rows } = await PaymentTransaction.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: Number(limit),
      offset,
    });
    res.json({ transactions: rows, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Payment links ─────────────────────────────────────────────────────────────
router.get("/api/payments/links", requireAuth, async (req, res) => {
  try {
    const origin = `${req.protocol}://${req.get("host")}`;
    await seedDemoLinks(origin);
    const links = await PaymentLink.findAll({ order: [["createdAt", "DESC"]] });
    res.json(links);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/api/payments/links", requireAuth, async (req, res) => {
  try {
    const origin = `${req.protocol}://${req.get("host")}`;
    const { provider, title, description, amount, currency, customerName, customerEmail, expiresInDays } = req.body;
    if (!provider || !title || !amount || !currency) {
      return res.status(400).json({ error: "provider, title, amount, currency required" });
    }
    const token = crypto.randomBytes(16).toString("hex");
    const expiresAt = expiresInDays ? new Date(Date.now() + Number(expiresInDays) * 86400000) : null;
    const link = await PaymentLink.create({
      provider,
      title,
      description: description ?? null,
      amount: Number(amount),
      currency,
      status:        "active",
      linkToken:     token,
      linkUrl:       `${origin}/pay/${token}`,
      expiresAt,
      customerName:  customerName ?? null,
      customerEmail: customerEmail ?? null,
      createdBy:     (req as AuthRequest).agent?.email ?? "system",
    });
    res.status(201).json(link);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.patch("/api/payments/links/:id", requireAuth, async (req, res) => {
  try {
    const link = await PaymentLink.findByPk(req.params.id);
    if (!link) return res.status(404).json({ error: "Not found" });
    const { status } = req.body;
    if (status) link.status = status;
    await link.save();
    res.json(link);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete("/api/payments/links/:id", requireAuth, async (req, res) => {
  try {
    const link = await PaymentLink.findByPk(req.params.id);
    if (!link) return res.status(404).json({ error: "Not found" });
    await link.destroy();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
