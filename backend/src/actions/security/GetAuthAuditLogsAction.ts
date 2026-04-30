import { Response } from "express";
import { Op } from "sequelize";
import { AuthRequest } from "../../middlewares/auth.js";
import { AuthAuditLog, User, Site } from "../../models/index.js";

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
      let explicitUserId: number | null = null;
      if (userIdRaw) {
        const uid = parseInt(userIdRaw, 10);
        if (Number.isFinite(uid)) {
          explicitUserId = uid;
          where.userId = uid;
        }
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

      // Site / department filters require constraining by user_id, since
      // auth_audit_logs only carries user_id (failed-unknown rows have null and
      // are intentionally excluded by these filters).
      const siteIdRaw = req.query.siteId ? String(req.query.siteId) : "";
      const departmentQ = req.query.department ? String(req.query.department).trim() : "";
      let siteFilterId: number | null = null;
      if (siteIdRaw) {
        const sid = parseInt(siteIdRaw, 10);
        if (Number.isFinite(sid)) siteFilterId = sid;
      }

      if (siteFilterId !== null || departmentQ) {
        const userWhere: any = {};
        if (siteFilterId !== null) userWhere.siteId = siteFilterId;
        if (departmentQ) userWhere.department = departmentQ;

        const matchingUsers = await User.findAll({ where: userWhere, attributes: ["id"] });
        const matchingIds = matchingUsers.map((u: any) => u.id as number);

        if (matchingIds.length === 0) {
          return res.json({ rows: [], page, pageSize, total: 0, totalPages: 1 });
        }
        if (explicitUserId !== null) {
          if (!matchingIds.includes(explicitUserId)) {
            return res.json({ rows: [], page, pageSize, total: 0, totalPages: 1 });
          }
          // keep where.userId = explicitUserId
        } else {
          where.userId = { [Op.in]: matchingIds };
        }
      }

      const { rows, count } = await AuthAuditLog.findAndCountAll({
        where,
        order: [["createdAt", "DESC"]],
        limit: pageSize,
        offset,
      });

      const userIds = Array.from(new Set(rows.map((r) => r.userId).filter((id): id is number => typeof id === "number")));
      const users = userIds.length
        ? await User.findAll({
            where: { id: { [Op.in]: userIds } },
            attributes: ["id", "name", "email", "role", "siteId", "department"],
          })
        : [];

      const siteIds = Array.from(new Set(users.map((u: any) => u.siteId).filter((s: any): s is number => typeof s === "number")));
      const sites = siteIds.length
        ? await Site.findAll({ where: { id: { [Op.in]: siteIds } }, attributes: ["id", "name"] })
        : [];
      const siteMap = new Map<number, string>();
      for (const s of sites) siteMap.set((s as any).id, (s as any).name);

      const userMap = new Map<number, { name: string; role: string; siteId: number | null; siteName: string | null; department: string | null }>();
      for (const u of users) {
        const siteId = (u as any).siteId ?? null;
        userMap.set(u.id, {
          name: (u as any).name,
          role: (u as any).role,
          siteId,
          siteName: siteId !== null ? siteMap.get(siteId) ?? null : null,
          department: (u as any).department ?? null,
        });
      }

      res.json({
        rows: rows.map((r) => {
          const u = r.userId ? userMap.get(r.userId) ?? null : null;
          return {
            id: r.id,
            userId: r.userId,
            userName: u?.name ?? null,
            userRole: u?.role ?? null,
            userSiteId: u?.siteId ?? null,
            userSiteName: u?.siteName ?? null,
            userDepartment: u?.department ?? null,
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
          };
        }),
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
