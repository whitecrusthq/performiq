import { Router } from "express";
import { Op, literal } from "sequelize";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import { CustomerGroup, SmartFilters } from "../models/CustomerGroup.js";
import { CustomerGroupMember } from "../models/CustomerGroupMember.js";
import { Customer } from "../models/Customer.js";
import { Conversation } from "../models/Conversation.js";
import { sequelize } from "../lib/database.js";

const router = Router();

async function resolveSmartMembers(filters: SmartFilters): Promise<number[]> {
  const where: any = {};
  if (filters.channels && filters.channels.length > 0) {
    where.channel = { [Op.in]: filters.channels };
  }
  if (filters.activeWithinDays) {
    const since = new Date(Date.now() - filters.activeWithinDays * 86400000);
    const activeCustomerIds = await Conversation.findAll({
      attributes: ["customerId"],
      where: { lastMessageAt: { [Op.gte]: since } },
      group: ["customer_id"],
      raw: true,
    });
    const ids = activeCustomerIds.map((c: any) => c.customerId);
    where.id = { [Op.in]: ids.length > 0 ? ids : [-1] };
  }
  if (filters.hasOpenConversation) {
    const openIds = await Conversation.findAll({
      attributes: ["customerId"],
      where: { status: { [Op.in]: ["open", "ongoing", "pending"] } },
      group: ["customer_id"],
      raw: true,
    });
    const ids = openIds.map((c: any) => c.customerId);
    const existing = where.id?.[Op.in] ?? null;
    if (existing) {
      where.id = { [Op.in]: existing.filter((id: number) => ids.includes(id)) };
    } else {
      where.id = { [Op.in]: ids.length > 0 ? ids : [-1] };
    }
  }
  const customers = await Customer.findAll({ attributes: ["id"], where, raw: true });
  return customers.map((c: any) => c.id);
}

router.get("/customer-groups", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const groups = await CustomerGroup.findAll({ order: [["createdAt", "DESC"]] });
    const result = await Promise.all(
      groups.map(async (g) => {
        let memberCount = 0;
        if (g.type === "manual") {
          memberCount = await CustomerGroupMember.count({ where: { groupId: g.id } });
        } else {
          const ids = await resolveSmartMembers(g.filters ?? {});
          memberCount = ids.length;
        }
        return { ...g.toJSON(), memberCount };
      })
    );
    res.json(result);
  } catch (err) {
    console.error("GET /customer-groups error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/customer-groups", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { name, description, type, filters, memberIds } = req.body;
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const group = await CustomerGroup.create({ name, description: description ?? null, type: type ?? "manual", filters: filters ?? null });
    if (type === "manual" && Array.isArray(memberIds) && memberIds.length > 0) {
      await CustomerGroupMember.bulkCreate(
        memberIds.map((cid: number) => ({ groupId: group.id, customerId: cid })),
        { ignoreDuplicates: true }
      );
    }
    const memberCount = type === "manual"
      ? await CustomerGroupMember.count({ where: { groupId: group.id } })
      : (await resolveSmartMembers(filters ?? {})).length;
    res.status(201).json({ ...group.toJSON(), memberCount });
  } catch (err) {
    console.error("POST /customer-groups error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/customer-groups/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const group = await CustomerGroup.findByPk(req.params.id);
    if (!group) { res.status(404).json({ error: "Not found" }); return; }
    let members: any[] = [];
    if (group.type === "manual") {
      const rows = await CustomerGroupMember.findAll({ where: { groupId: group.id } });
      const ids = rows.map((r) => r.customerId);
      members = ids.length > 0 ? await Customer.findAll({ where: { id: { [Op.in]: ids } } }) : [];
    } else {
      const ids = await resolveSmartMembers(group.filters ?? {});
      members = ids.length > 0 ? await Customer.findAll({ where: { id: { [Op.in]: ids } } }) : [];
    }
    res.json({ ...group.toJSON(), members, memberCount: members.length });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/customer-groups/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const group = await CustomerGroup.findByPk(req.params.id);
    if (!group) { res.status(404).json({ error: "Not found" }); return; }
    const { name, description, type, filters, memberIds } = req.body;
    await group.update({
      name: name ?? group.name,
      description: description ?? group.description,
      type: type ?? group.type,
      filters: filters ?? group.filters,
    });
    if ((type ?? group.type) === "manual" && Array.isArray(memberIds)) {
      await CustomerGroupMember.destroy({ where: { groupId: group.id } });
      if (memberIds.length > 0) {
        await CustomerGroupMember.bulkCreate(
          memberIds.map((cid: number) => ({ groupId: group.id, customerId: cid })),
          { ignoreDuplicates: true }
        );
      }
    }
    const memberCount = (type ?? group.type) === "manual"
      ? await CustomerGroupMember.count({ where: { groupId: group.id } })
      : (await resolveSmartMembers(filters ?? group.filters ?? {})).length;
    res.json({ ...group.toJSON(), memberCount });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/customer-groups/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const group = await CustomerGroup.findByPk(req.params.id);
    if (!group) { res.status(404).json({ error: "Not found" }); return; }
    await group.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/customer-groups/:id/preview", requireAuth, async (req: AuthRequest, res) => {
  try {
    const group = await CustomerGroup.findByPk(req.params.id);
    if (!group) { res.status(404).json({ error: "Not found" }); return; }
    let count = 0;
    if (group.type === "manual") {
      count = await CustomerGroupMember.count({ where: { groupId: group.id } });
    } else {
      count = (await resolveSmartMembers(group.filters ?? {})).length;
    }
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
