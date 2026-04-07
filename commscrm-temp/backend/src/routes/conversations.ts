import { Router } from "express";
import { Op } from "sequelize";
import { Conversation, Customer, Agent, Message, ClosedConversation, ClosedMessage } from "../models/index.js";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";

const router = Router();

const LOCK_TIMEOUT_MINUTES = 10;

function isLockExpired(lockedAt: Date | null): boolean {
  if (!lockedAt) return true;
  const expiresAt = new Date(lockedAt.getTime() + LOCK_TIMEOUT_MINUTES * 60 * 1000);
  return new Date() > expiresAt;
}

router.get("/conversations", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { status, channel, search, page = "1", limit = "50" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where: Record<string, unknown> = {};
    if (status && status !== "all") {
      const statuses = status.split(",").map((s) => s.trim()).filter(Boolean);
      where.status = statuses.length === 1 ? statuses[0] : { [Op.in]: statuses };
    }
    if (channel) where.channel = channel;

    const customerWhere: Record<string, unknown> = {};
    if (search) {
      customerWhere.name = { [Op.iLike]: `%${search}%` };
    }

    const { count, rows } = await Conversation.findAndCountAll({
      where,
      include: [
        {
          model: Customer,
          as: "customer",
          where: Object.keys(customerWhere).length ? customerWhere : undefined,
          attributes: ["id", "name", "phone", "channel"],
        },
        {
          model: Agent,
          as: "assignedAgent",
          attributes: ["id", "name", "avatar"],
          required: false,
        },
        {
          model: Agent,
          as: "lockedByAgent",
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: Message,
          as: "messages",
          attributes: ["content", "sender", "createdAt"],
          order: [["createdAt", "DESC"]],
          limit: 1,
          required: false,
          separate: true,
        },
      ],
      order: [["lastMessageAt", "DESC"], ["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset,
    });

    const conversations = rows.map((conv) => {
      const lockExpired = isLockExpired(conv.lockedAt);
      const lockedByAgent = (conv as unknown as { lockedByAgent?: { id: number; name: string } }).lockedByAgent;
      const messages = (conv as unknown as { messages?: Array<{ content: string; sender: string; createdAt: string }> }).messages ?? [];
      const lastMessage = messages.length > 0 ? { content: messages[0].content, sender: messages[0].sender } : null;
      return {
        ...conv.toJSON(),
        isLocked: !lockExpired && !!conv.lockedByAgentId,
        lockedByAgent: !lockExpired ? lockedByAgent : null,
        lockedByAgentId: !lockExpired ? conv.lockedByAgentId : null,
        lastMessage,
        messages: undefined,
      };
    });

    res.json({ total: count, page: parseInt(page), conversations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/conversations/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const conversation = await Conversation.findByPk(req.params.id, {
      include: [
        { model: Customer, as: "customer" },
        { model: Agent, as: "assignedAgent", attributes: ["id", "name", "avatar", "email"], required: false },
        { model: Agent, as: "lockedByAgent", attributes: ["id", "name"], required: false },
        {
          model: Message,
          as: "messages",
          order: [["createdAt", "ASC"]],
          limit: 100,
        },
      ],
    });
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    res.json(conversation);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/conversations/:id/claim", requireAuth, async (req: AuthRequest, res) => {
  try {
    const agentId = req.agent!.id;
    const conversation = await Conversation.findByPk(req.params.id, {
      include: [{ model: Agent, as: "lockedByAgent", attributes: ["id", "name"], required: false }],
    });

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const lockExpired = isLockExpired(conversation.lockedAt);
    const isLockedByOther = !lockExpired && conversation.lockedByAgentId && conversation.lockedByAgentId !== agentId;

    if (isLockedByOther) {
      const lockedByAgent = (conversation as unknown as { lockedByAgent?: { id: number; name: string } }).lockedByAgent;
      res.status(409).json({
        error: "conversation_locked",
        message: `This conversation is currently being handled by ${lockedByAgent?.name ?? "another agent"}.`,
        lockedBy: lockedByAgent,
      });
      return;
    }

    conversation.lockedByAgentId = agentId;
    conversation.lockedAt = new Date();
    await conversation.save();

    res.json({ success: true, lockedByAgentId: agentId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/conversations/:id/force-claim", requireAuth, async (req: AuthRequest, res) => {
  try {
    const agentId = req.agent!.id;
    const conversation = await Conversation.findByPk(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    conversation.lockedByAgentId = agentId;
    conversation.lockedAt = new Date();
    await conversation.save();
    res.json({ success: true, lockedByAgentId: agentId });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/conversations/:id/release", requireAuth, async (req: AuthRequest, res) => {
  try {
    const agentId = req.agent!.id;
    const conversation = await Conversation.findByPk(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    if (conversation.lockedByAgentId === agentId) {
      conversation.lockedByAgentId = null;
      conversation.lockedAt = null;
      await conversation.save();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/conversations/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const agentId = req.agent!.id;
    const conversation = await Conversation.findByPk(req.params.id, {
      include: [
        { model: Customer, as: "customer", attributes: ["id", "name", "phone"] },
        { model: Agent, as: "assignedAgent", attributes: ["id", "name"], required: false },
        { model: Message, as: "messages", order: [["createdAt", "ASC"]] },
      ],
    });

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const { status, assignedAgentId } = req.body;

    if (status === "closed") {
      const customer = (conversation as unknown as { customer: { id: number; name: string; phone: string | null } }).customer;
      const assignedAgent = (conversation as unknown as { assignedAgent?: { id: number; name: string } | null }).assignedAgent;
      const messages = (conversation as unknown as { messages: Array<{ sender: string; content: string; isRead: boolean; createdAt: Date }> }).messages ?? [];

      let closingAgentName: string | null = null;
      const closingAgent = await Agent.findByPk(agentId, { attributes: ["name"] });
      if (closingAgent) closingAgentName = closingAgent.name;

      const closed = await ClosedConversation.create({
        originalId: conversation.id,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        assignedAgentId: conversation.assignedAgentId,
        assignedAgentName: assignedAgent?.name ?? null,
        closedByAgentId: agentId,
        closedByAgentName: closingAgentName,
        channel: conversation.channel,
        messageCount: messages.length,
        closedAt: new Date(),
        originalCreatedAt: conversation.createdAt,
      });

      if (messages.length > 0) {
        await ClosedMessage.bulkCreate(
          messages.map((m) => ({
            closedConversationId: closed.id,
            sender: m.sender as "customer" | "agent" | "bot",
            content: m.content,
            isRead: m.isRead,
            originalCreatedAt: m.createdAt,
          }))
        );
      }

      await Message.destroy({ where: { conversationId: conversation.id } });
      await conversation.destroy();

      res.json({ archived: true, closedConversationId: closed.id });
      return;
    }

    if (status) {
      const wasResolved = conversation.status === "resolved";
      const reopening = wasResolved && (status === "open" || status === "ongoing" || status === "pending");
      conversation.status = status as "open" | "ongoing" | "pending" | "resolved";
      if (reopening) conversation.reopenCount = (conversation.reopenCount ?? 0) + 1;
    }
    if (assignedAgentId !== undefined) conversation.assignedAgentId = assignedAgentId;
    await conversation.save();
    res.json(conversation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/conversations/:id/messages", requireAuth, async (req: AuthRequest, res) => {
  try {
    const messages = await Message.findAll({
      where: { conversationId: req.params.id },
      order: [["createdAt", "ASC"]],
    });

    await Message.update({ isRead: true }, { where: { conversationId: req.params.id, sender: "customer", isRead: false } });
    await Conversation.update({ unreadCount: 0 }, { where: { id: req.params.id } });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/conversations/:id/follow-up", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { followUpAt, followUpNote, followUpType } = req.body;
    const conversation = await Conversation.findByPk(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    await conversation.update({
      followUpAt: followUpAt ? new Date(followUpAt) : null,
      followUpNote: followUpNote ?? null,
      followUpType: followUpType ?? null,
    });
    res.json({ success: true, followUpAt: conversation.followUpAt, followUpNote: conversation.followUpNote, followUpType: conversation.followUpType });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/follow-ups", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { customerId, followUpAt, followUpNote, followUpType, channel } = req.body;
    if (!customerId || !followUpAt) {
      res.status(400).json({ error: "customerId and followUpAt are required" });
      return;
    }
    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    const convChannel = channel || customer.channel || "whatsapp";
    let conversation = await Conversation.findOne({
      where: { customerId, status: { [Op.in]: ["open", "pending"] } },
      order: [["createdAt", "DESC"]],
    });
    if (!conversation) {
      conversation = await Conversation.create({
        customerId,
        channel: convChannel as "whatsapp" | "facebook" | "instagram",
        status: "open",
        assignedAgentId: req.agent?.id ?? null,
      });
    }
    await conversation.update({
      followUpAt: new Date(followUpAt),
      followUpNote: followUpNote ?? null,
      followUpType: followUpType ?? null,
    });
    res.json({ success: true, conversationId: conversation.id, followUpAt: conversation.followUpAt, followUpType: conversation.followUpType });
  } catch (err) {
    console.error("POST /follow-ups error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/follow-ups", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const followUps = await Conversation.findAll({
      where: { followUpAt: { [Op.not]: null } },
      include: [
        { model: Customer, as: "customer", attributes: ["id", "name", "phone", "channel"] },
        { model: Agent, as: "assignedAgent", attributes: ["id", "name", "avatar"], required: false },
      ],
      order: [["followUpAt", "ASC"]],
      limit: 100,
    });
    res.json(followUps);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/conversations/:id/messages", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { content, sender = "agent" } = req.body;
    if (!content) {
      res.status(400).json({ error: "Message content is required" });
      return;
    }

    const message = await Message.create({
      conversationId: parseInt(req.params.id),
      sender,
      content,
      isRead: sender === "agent",
    });

    await Conversation.update(
      { lastMessageAt: new Date(), status: sender === "agent" ? "ongoing" : "open", lockedAt: new Date() },
      { where: { id: req.params.id } }
    );

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
