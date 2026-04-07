import { Router } from "express";
import { Feedback } from "../models/index.js";
import { Customer } from "../models/Customer.js";
import { Agent } from "../models/Agent.js";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.get("/feedback", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const feedback = await Feedback.findAll({
      include: [
        { model: Customer, as: "customer", attributes: ["id", "name", "phone", "channel"], required: false },
        { model: Agent, as: "agent", attributes: ["id", "name", "avatar"], required: false },
      ],
      order: [["createdAt", "DESC"]],
      limit: 200,
    });
    const total = await Feedback.count();
    const avgRating = total > 0
      ? (await Feedback.findAll({ attributes: ["rating"] })).reduce((s, f) => s + f.rating, 0) / total
      : 0;
    res.json({ total, avgRating: Math.round(avgRating * 10) / 10, feedback });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/feedback", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { conversationId, customerId, rating, comment, channel } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({ error: "Rating must be between 1 and 5" });
      return;
    }
    const fb = await Feedback.create({
      conversationId: conversationId ?? null,
      customerId: customerId ?? null,
      rating,
      comment: comment ?? null,
      channel: channel ?? "whatsapp",
      agentId: req.agent?.id ?? null,
    });
    res.status(201).json(fb);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Public endpoint — no auth required ─────────────────────────────────────
router.post("/feedback/public", async (req, res) => {
  try {
    const { rating, comment, channel, customerName } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({ error: "Rating must be between 1 and 5" });
      return;
    }
    const fb = await Feedback.create({
      conversationId: null,
      customerId: null,
      rating,
      comment: comment ?? null,
      channel: channel ?? "web",
      agentId: null,
    });
    res.status(201).json({ ok: true, id: fb.id, customerName: customerName ?? null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
