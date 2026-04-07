import { Router } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import { FollowUpRule } from "../models/FollowUpRule.js";

const router = Router();

const DEFAULT_RULES = [
  {
    name: "Sales Follow-up",
    category: "sales" as const,
    isEnabled: false,
    delayDays: 2,
    trigger: "resolved" as const,
    inactivityDays: null,
    messageTemplate: "Hi {{customerName}}! 👋 Thanks for reaching out to us. We wanted to follow up to see if you had any further questions about our products or if there's anything else we can help you with. We'd love to assist you!",
    useAiPersonalization: true,
    assignToLastAgent: true,
    priority: "high" as const,
    sendBetweenHoursStart: 9,
    sendBetweenHoursEnd: 18,
  },
  {
    name: "Reminder – Pending Action",
    category: "reminder" as const,
    isEnabled: false,
    delayDays: 1,
    trigger: "inactive" as const,
    inactivityDays: 3,
    messageTemplate: "Hi {{customerName}}, just a friendly reminder that your request is still open with us. Would you like to continue where we left off? Our team is here to help! 😊",
    useAiPersonalization: false,
    assignToLastAgent: true,
    priority: "medium" as const,
    sendBetweenHoursStart: 9,
    sendBetweenHoursEnd: 17,
  },
  {
    name: "Product Update Notification",
    category: "product_update" as const,
    isEnabled: false,
    delayDays: 7,
    trigger: "manual" as const,
    inactivityDays: null,
    messageTemplate: "Hi {{customerName}}! 🎉 We have exciting updates to share with you! We've recently improved our services and wanted to make sure you're among the first to know. Tap here to find out more!",
    useAiPersonalization: true,
    assignToLastAgent: false,
    priority: "low" as const,
    sendBetweenHoursStart: 10,
    sendBetweenHoursEnd: 16,
  },
  {
    name: "Special Discount Offer",
    category: "discount" as const,
    isEnabled: false,
    delayDays: 5,
    trigger: "resolved" as const,
    inactivityDays: null,
    messageTemplate: "Hi {{customerName}}! 🎁 As a valued customer, we're offering you an exclusive discount. Use code SPECIAL20 for 20% off your next purchase. This offer expires soon — don't miss it!",
    useAiPersonalization: false,
    assignToLastAgent: false,
    priority: "medium" as const,
    sendBetweenHoursStart: 9,
    sendBetweenHoursEnd: 20,
  },
  {
    name: "Re-engagement Campaign",
    category: "reengagement" as const,
    isEnabled: false,
    delayDays: 30,
    trigger: "inactive" as const,
    inactivityDays: 30,
    messageTemplate: "Hi {{customerName}}! We've missed you 💙 It's been a while since we last connected. We have some new offers and updates that might interest you. Would you like to catch up?",
    useAiPersonalization: true,
    assignToLastAgent: false,
    priority: "low" as const,
    sendBetweenHoursStart: 10,
    sendBetweenHoursEnd: 18,
  },
];

// GET /api/follow-up-rules
router.get("/follow-up-rules", requireAuth, async (_req: AuthRequest, res) => {
  try {
    let rules = await FollowUpRule.findAll({ order: [["id", "ASC"]] });
    if (rules.length === 0) {
      rules = await FollowUpRule.bulkCreate(DEFAULT_RULES);
    }
    res.json({ rules });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/follow-up-rules
router.post("/follow-up-rules", requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      name, category, isEnabled, delayDays, trigger, inactivityDays,
      messageTemplate, useAiPersonalization, assignToLastAgent, priority,
      sendBetweenHoursStart, sendBetweenHoursEnd,
    } = req.body;

    if (!name || !messageTemplate) {
      res.status(400).json({ error: "name and messageTemplate are required" });
      return;
    }

    const rule = await FollowUpRule.create({
      name,
      category: category ?? "custom",
      isEnabled: isEnabled ?? false,
      delayDays: delayDays ?? 3,
      trigger: trigger ?? "manual",
      inactivityDays: inactivityDays ?? null,
      messageTemplate,
      useAiPersonalization: useAiPersonalization ?? false,
      assignToLastAgent: assignToLastAgent ?? true,
      priority: priority ?? "medium",
      sendBetweenHoursStart: sendBetweenHoursStart ?? 9,
      sendBetweenHoursEnd: sendBetweenHoursEnd ?? 18,
    });

    res.status(201).json({ rule });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/follow-up-rules/:id
router.put("/follow-up-rules/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const rule = await FollowUpRule.findByPk(req.params.id);
    if (!rule) { res.status(404).json({ error: "Rule not found" }); return; }

    const fields = [
      "name", "category", "isEnabled", "delayDays", "trigger", "inactivityDays",
      "messageTemplate", "useAiPersonalization", "assignToLastAgent", "priority",
      "sendBetweenHoursStart", "sendBetweenHoursEnd",
    ] as const;

    for (const f of fields) {
      if (req.body[f] !== undefined) (rule as any)[f] = req.body[f];
    }

    await rule.save();
    res.json({ rule });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/follow-up-rules/:id/toggle
router.post("/follow-up-rules/:id/toggle", requireAuth, async (req: AuthRequest, res) => {
  try {
    const rule = await FollowUpRule.findByPk(req.params.id);
    if (!rule) { res.status(404).json({ error: "Rule not found" }); return; }
    rule.isEnabled = !rule.isEnabled;
    await rule.save();
    res.json({ rule });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/follow-up-rules/:id
router.delete("/follow-up-rules/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const rule = await FollowUpRule.findByPk(req.params.id);
    if (!rule) { res.status(404).json({ error: "Rule not found" }); return; }
    await rule.destroy();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
