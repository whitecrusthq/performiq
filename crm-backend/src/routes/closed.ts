import { Router } from "express";
import { Op } from "sequelize";
import { ClosedConversation, ClosedMessage } from "../models/index.js";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.get("/closed-conversations", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { search, channel, page = "1", limit = "50" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where: Record<string, unknown> = {};
    if (channel) where.channel = channel;
    if (search) {
      where.customerName = { [Op.iLike]: `%${search}%` };
    }

    const { count, rows } = await ClosedConversation.findAndCountAll({
      where,
      order: [["closedAt", "DESC"]],
      limit: parseInt(limit),
      offset,
    });

    res.json({ total: count, page: parseInt(page), conversations: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/closed-conversations/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const conversation = await ClosedConversation.findByPk(req.params.id, {
      include: [{ model: ClosedMessage, as: "messages", order: [["originalCreatedAt", "ASC"]] }],
    });
    if (!conversation) {
      res.status(404).json({ error: "Closed conversation not found" });
      return;
    }
    res.json(conversation);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/closed-conversations/:id/messages", requireAuth, async (req: AuthRequest, res) => {
  try {
    const messages = await ClosedMessage.findAll({
      where: { closedConversationId: req.params.id },
      order: [["originalCreatedAt", "ASC"]],
    });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
