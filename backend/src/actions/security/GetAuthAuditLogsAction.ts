import { Response } from "express";
import { Op } from "sequelize";
import { AuthRequest } from "../../middlewares/auth.js";
import { AuthAuditLog, User } from "../../models/index.js";

const MAX_PAGE_SIZE = 200;
const ALLOWED_EVENTS = new Set(["login_success", "login_failed", "logout"]);

export class GetAuthAuditLogsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
      const pageSizeRaw = parseInt(String(req.query.pageSize ?? "50"), 10) || 50;
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSizeRaw));
      const offset = (page - 1) * pageSize;

      const where: any = {};
      const event = req.query.event ? String(req.query.event) : "";
      if (event && ALLOWED_EVENTS.has(event)) where.event = event;

      const userIdRaw = req.query.userId ? String(req.query.userId) : "";
      if (userIdRaw) {
        const uid = parseInt(userIdRaw, 10);
        if (Number.isFinite(uid)) where.userId = uid;
      }

      const emailQ = req.query.email ? String(req.query.email).trim().toLowerCase() : "";
      if (emailQ) where.email = { [Op.iLike]: `%${emailQ}%` };

      const from = req.query.from ? new Date(String(req.query.from)) : null;
      const to = req.query.to ? new Date(String(req.query.to)) : null;
      if (from && !isNaN(from.getTime())) {
        where.createdAt = { ...(where.createdAt || {}), [Op.gte]: from };
      }
      if (to && !isNaN(to.getTime())) {
        where.createdAt = { ...(where.createdAt || {}), [Op.lte]: to };
      }

      const { rows, count } = await AuthAuditLog.findAndCountAll({
        where,
        order: [["createdAt", "DESC"]],
        limit: pageSize,
        offset,
      });

      const userIds = Array.from(new Set(rows.map((r) => r.userId).filter((id): id is number => typeof id === "number")));
      const users = userIds.length
        ? await User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ["id", "name", "email", "role"] })
        : [];
      const userMap = new Map<number, { name: string; role: string }>();
      for (const u of users) userMap.set(u.id, { name: (u as any).name, role: (u as any).role });

      res.json({
        rows: rows.map((r) => ({
          id: r.id,
          userId: r.userId,
          userName: r.userId ? userMap.get(r.userId)?.name ?? null : null,
          userRole: r.userId ? userMap.get(r.userId)?.role ?? null : null,
          email: r.email,
          event: r.event,
          failureReason: r.failureReason,
          ipAddress: r.ipAddress,
          userAgent: r.userAgent,
          country: r.country,
          region: r.region,
          city: r.city,
          latitude: r.latitude,
          longitude: r.longitude,
          createdAt: r.createdAt,
        })),
        page,
        pageSize,
        total: count,
        totalPages: Math.max(1, Math.ceil(count / pageSize)),
      });
    } catch (err) {
      console.error("GetAuthAuditLogs error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
