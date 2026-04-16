import { Op, QueryTypes } from "sequelize";
import { HrQuery, HrQueryMessage, User } from "../models/index.js";
import sequelize from "../db/sequelize.js";

export default class HrQueryController {
  static async enrichQuery(q: any) {
    const submitter = await User.findOne({
      where: { id: q.userId },
      attributes: ["id", "name", "email"],
    });

    let assignee = null;
    if (q.assignedTo) {
      assignee = await User.findOne({
        where: { id: q.assignedTo },
        attributes: ["id", "name", "email"],
      }) ?? null;
    }

    let responder = null;
    if (q.respondedBy) {
      responder = await User.findOne({
        where: { id: q.respondedBy },
        attributes: ["id", "name", "email"],
      }) ?? null;
    }

    const plain = q.get ? q.get({ plain: true }) : q;
    return { ...plain, submitter: submitter ?? null, assignee, responder };
  }

  static isHR(user: any) {
    return ["super_admin", "admin"].includes(user.role) ||
      user.customRoleName?.toLowerCase() === "hr manager";
  }

  static async listQueries(user: any) {
    const isHR = HrQueryController.isHR(user);
    const rows = isHR
      ? await HrQuery.findAll({ order: [["createdAt", "DESC"]] })
      : await HrQuery.findAll({ where: { userId: user.id }, order: [["createdAt", "DESC"]] });
    return Promise.all(rows.map(r => HrQueryController.enrichQuery(r)));
  }

  static async getQuery(id: number, user: any) {
    const q = await HrQuery.findByPk(id);
    if (!q) return { error: "Not found", status: 404 };
    const isHR = HrQueryController.isHR(user);
    if (!isHR && q.userId !== user.id) return { error: "Forbidden", status: 403 };
    return { data: await HrQueryController.enrichQuery(q) };
  }

  static async createQuery(userId: number, data: { title: string; description: string; category?: string; priority?: string }) {
    const q = await HrQuery.create({
      userId,
      title: data.title.trim(),
      description: data.description.trim(),
      category: data.category || "general",
      priority: data.priority || "normal",
    });
    return HrQueryController.enrichQuery(q);
  }

  static async updateQuery(id: number, user: any, body: any) {
    const q = await HrQuery.findByPk(id);
    if (!q) return { error: "Not found", status: 404 };

    const isHR = HrQueryController.isHR(user);
    const isOwner = q.userId === user.id;
    if (!isHR && !isOwner) return { error: "Forbidden", status: 403 };

    const updates: Record<string, any> = { updatedAt: new Date() };

    if (isHR) {
      if (body.status !== undefined) updates.status = body.status;
      if (body.priority !== undefined) updates.priority = body.priority;
      if (body.assignedTo !== undefined) updates.assignedTo = body.assignedTo || null;
      if (body.response !== undefined) {
        updates.response = body.response;
        updates.respondedBy = user.id;
        updates.respondedAt = new Date();
      }
    }

    if (isOwner && q.status === "open") {
      if (body.title !== undefined) updates.title = body.title.trim();
      if (body.description !== undefined) updates.description = body.description.trim();
      if (body.category !== undefined) updates.category = body.category;
      if (body.priority !== undefined) updates.priority = body.priority;
    }

    const [, rows] = await HrQuery.update(updates, { where: { id }, returning: true });
    return { data: await HrQueryController.enrichQuery(rows[0]) };
  }

  static async getMessages(id: number, user: any) {
    const q = await HrQuery.findByPk(id);
    if (!q) return { error: "Not found", status: 404 };
    const isHR = HrQueryController.isHR(user);
    if (!isHR && q.userId !== user.id) return { error: "Forbidden", status: 403 };

    const msgs = await sequelize.query(
      `SELECT m.id, m.query_id AS "queryId", m.sender_id AS "senderId", m.body, m.created_at AS "createdAt", u.name AS "senderName", u.role AS "senderRole"
       FROM hr_query_messages m
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.query_id = :id
       ORDER BY m.created_at ASC`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    return { data: msgs };
  }

  static async createMessage(id: number, user: any, body: string) {
    const q = await HrQuery.findByPk(id);
    if (!q) return { error: "Not found", status: 404 };
    const isHR = HrQueryController.isHR(user);
    if (!isHR && q.userId !== user.id) return { error: "Forbidden", status: 403 };
    if (q.status === "closed") return { error: "Query is closed", status: 400 };

    const msg = await HrQueryMessage.create({
      queryId: id,
      senderId: user.id,
      body: body.trim(),
    });

    if (isHR && q.status === "open") {
      await HrQuery.update({
        status: "in_progress",
        respondedBy: user.id,
        respondedAt: new Date(),
        updatedAt: new Date(),
      }, { where: { id } });
    } else {
      await HrQuery.update({ updatedAt: new Date() }, { where: { id } });
    }

    return { data: { ...msg.get({ plain: true }), senderName: (user as any).name || user.email, senderRole: user.role } };
  }

  static async deleteQuery(id: number, user: any) {
    const q = await HrQuery.findByPk(id);
    if (!q) return { error: "Not found", status: 404 };

    const isHR = HrQueryController.isHR(user);
    const isOwner = q.userId === user.id && q.status === "open";
    if (!isHR && !isOwner) return { error: "Forbidden", status: 403 };

    await HrQuery.destroy({ where: { id } });
    return { success: true };
  }
}
