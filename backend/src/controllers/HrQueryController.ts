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
    const firstResponseAt = plain.firstResponseAt ?? plain.first_response_at ?? null;
    const resolvedAt = plain.resolvedAt ?? plain.resolved_at ?? null;
    const responseHours = firstResponseAt
      ? (new Date(firstResponseAt).getTime() - new Date(plain.createdAt).getTime()) / 36e5
      : null;
    const resolutionHours = resolvedAt
      ? (new Date(resolvedAt).getTime() - new Date(plain.createdAt).getTime()) / 36e5
      : null;

    return {
      ...plain,
      submitter: submitter ?? null,
      assignee,
      responder,
      responseHours,
      resolutionHours,
    };
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

    const VALID_STATUS = new Set(["open", "in_progress", "resolved", "closed"]);
    const VALID_PRIORITY = new Set(["high", "normal", "low"]);

    const updates: Record<string, any> = { updatedAt: new Date() };

    if (isHR) {
      if (body.status !== undefined) {
        if (!VALID_STATUS.has(body.status)) return { error: "Invalid status", status: 400 };
        updates.status = body.status;
        // Stamp lifecycle timestamps atomically with COALESCE so concurrent
        // updates don't overwrite an earlier resolved/closed timestamp.
        if (body.status === "resolved") {
          updates.resolvedAt = sequelize.literal("COALESCE(resolved_at, NOW())");
        }
        if (body.status === "closed") {
          updates.closedAt = sequelize.literal("COALESCE(closed_at, NOW())");
          updates.resolvedAt = sequelize.literal("COALESCE(resolved_at, NOW())");
        }
        // Reopening clears terminal timestamps
        if (body.status === "open" || body.status === "in_progress") {
          updates.resolvedAt = null;
          updates.closedAt = null;
        }
      }
      if (body.priority !== undefined) {
        if (!VALID_PRIORITY.has(body.priority)) return { error: "Invalid priority", status: 400 };
        updates.priority = body.priority;
      }
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
      if (body.priority !== undefined) {
        if (!VALID_PRIORITY.has(body.priority)) return { error: "Invalid priority", status: 400 };
        updates.priority = body.priority;
      }
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

    const queryUpdates: Record<string, any> = { updatedAt: new Date() };
    if (isHR) {
      // First HR reply stamps the response-time metric atomically — COALESCE
      // ensures the first writer wins under concurrent first replies.
      queryUpdates.firstResponseAt = sequelize.literal("COALESCE(first_response_at, NOW())");
      if (q.status === "open") {
        queryUpdates.status = "in_progress";
        queryUpdates.respondedBy = user.id;
        queryUpdates.respondedAt = new Date();
      }
    }
    await HrQuery.update(queryUpdates, { where: { id } });

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

  // ── Transfer / Escalate ────────────────────────────────────────────────────
  private static async postSystemMessage(queryId: number, senderId: number, body: string) {
    await HrQueryMessage.create({ queryId, senderId, body });
  }

  static async transferQuery(id: number, user: any, body: { assignedTo: number; reason?: string }) {
    const q = await HrQuery.findByPk(id);
    if (!q) return { error: "Not found", status: 404 };
    if (!HrQueryController.isHR(user)) return { error: "Forbidden", status: 403 };
    if (q.status === "closed") return { error: "Cannot transfer a closed ticket", status: 400 };

    const targetId = parseInt(String(body.assignedTo), 10);
    if (!Number.isFinite(targetId)) return { error: "assignedTo is required", status: 400 };
    const target = await User.findByPk(targetId);
    if (!target) return { error: "Target user not found", status: 400 };
    if (!(await HrQueryController.isHRById(targetId))) {
      return { error: "Target user is not an HR officer", status: 400 };
    }
    if (q.assignedTo === targetId) return { error: "Ticket is already assigned to that user", status: 400 };

    const reason = (body.reason ?? "").toString().trim().slice(0, 1000);
    const now = new Date();
    // Conditional update — refuses to mutate if the ticket was closed by
    // another request between our read above and this write.
    const [affected] = await HrQuery.update({
      assignedTo: targetId,
      transferredAt: now,
      transferredBy: user.id,
      transferReason: reason || null,
      status: q.status === "open" ? "in_progress" : q.status,
      updatedAt: now,
    }, { where: { id, status: { [Op.ne]: "closed" } } });
    if (affected === 0) return { error: "Ticket was just closed and can no longer be transferred", status: 409 };

    const fromName = q.assignedTo
      ? (await User.findByPk(q.assignedTo))?.get("name") as string | undefined
      : null;
    const bodyMsg = [
      `🔁 Ticket transferred${fromName ? ` from ${fromName}` : ""} to ${target.get("name")}.`,
      reason ? `Reason: ${reason}` : null,
    ].filter(Boolean).join("\n");
    await HrQueryController.postSystemMessage(id, user.id, bodyMsg);

    const fresh = await HrQuery.findByPk(id);
    return { data: await HrQueryController.enrichQuery(fresh!) };
  }

  static async escalateQuery(id: number, user: any, body: { reason?: string; assignedTo?: number }) {
    const q = await HrQuery.findByPk(id);
    if (!q) return { error: "Not found", status: 404 };
    if (!HrQueryController.isHR(user)) return { error: "Forbidden", status: 403 };
    if (q.status === "closed") return { error: "Cannot escalate a closed ticket", status: 400 };

    const reason = (body.reason ?? "").toString().trim().slice(0, 1000);
    const now = new Date();
    const updates: Record<string, any> = {
      priority: "high",
      escalatedAt: now,
      escalatedBy: user.id,
      escalationReason: reason || null,
      status: q.status === "open" ? "in_progress" : q.status,
      updatedAt: now,
    };

    let targetUser: any = null;
    if (body.assignedTo !== undefined && body.assignedTo !== null && String(body.assignedTo) !== "") {
      const targetId = parseInt(String(body.assignedTo), 10);
      if (!Number.isFinite(targetId)) return { error: "Invalid assignedTo", status: 400 };
      targetUser = await User.findByPk(targetId);
      if (!targetUser) return { error: "Target user not found", status: 400 };
      if (!(await HrQueryController.isHRById(targetId))) {
        return { error: "Target user is not an HR officer", status: 400 };
      }
      updates.assignedTo = targetId;
      if (q.assignedTo !== targetId) {
        updates.transferredAt = now;
        updates.transferredBy = user.id;
      }
    }
    const [affected] = await HrQuery.update(updates, { where: { id, status: { [Op.ne]: "closed" } } });
    if (affected === 0) return { error: "Ticket was just closed and can no longer be escalated", status: 409 };

    const bodyMsg = [
      `🚨 Ticket escalated${targetUser ? ` and reassigned to ${targetUser.get("name")}` : ""}. Priority set to High.`,
      reason ? `Reason: ${reason}` : null,
    ].filter(Boolean).join("\n");
    await HrQueryController.postSystemMessage(id, user.id, bodyMsg);

    const fresh = await HrQuery.findByPk(id);
    return { data: await HrQueryController.enrichQuery(fresh!) };
  }

  // ── HR officers picker ────────────────────────────────────────────────────
  static async isHRById(userId: number): Promise<boolean> {
    const rows: any[] = await sequelize.query(
      `SELECT u.role, COALESCE(cr.name, '') AS "customRoleName"
         FROM users u
         LEFT JOIN custom_roles cr ON u.custom_role_id = cr.id
        WHERE u.id = :id
          AND COALESCE(u.is_active, TRUE) = TRUE
        LIMIT 1`,
      { replacements: { id: userId }, type: QueryTypes.SELECT }
    );
    const row = rows[0];
    if (!row) return false;
    if (["super_admin", "admin"].includes(row.role)) return true;
    return String(row.customRoleName).toLowerCase() === "hr manager";
  }

  static async listHrUsers() {
    const rows: any[] = await sequelize.query(
      `SELECT u.id, u.name, u.email, u.role,
              cr.name AS "customRoleName"
         FROM users u
         LEFT JOIN custom_roles cr ON u.custom_role_id = cr.id
        WHERE COALESCE(u.is_active, TRUE) = TRUE
          AND (
            u.role IN ('super_admin','admin')
            OR LOWER(COALESCE(cr.name, '')) = 'hr manager'
          )
        ORDER BY u.name ASC`,
      { type: QueryTypes.SELECT }
    );
    return rows;
  }

  // ── Metrics / KPI dashboard ───────────────────────────────────────────────
  static slaTargetHours(priority: string): number {
    if (priority === "high") return 4;
    if (priority === "low") return 72;
    return 24; // normal
  }

  static async getMetrics() {
    // SLA target expression — keep in sync with slaTargetHours()
    const slaCase = `CASE WHEN priority='high' THEN 4 WHEN priority='low' THEN 72 ELSE 24 END`;

    const [totalsRows, windowedRows, slaRows, categoryRows, openByPriorityRows, assigneeRows, trendRows] = await Promise.all([
      sequelize.query(
        `SELECT
            COUNT(*)::int AS all_count,
            COUNT(*) FILTER (WHERE status='open')::int AS open_c,
            COUNT(*) FILTER (WHERE status='in_progress')::int AS in_progress_c,
            COUNT(*) FILTER (WHERE status='resolved')::int AS resolved_c,
            COUNT(*) FILTER (WHERE status='closed')::int AS closed_c,
            COUNT(*) FILTER (WHERE escalated_at IS NOT NULL)::int AS escalated_c,
            COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('day', NOW()))::int AS today_c,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS week_c
           FROM hr_queries`,
        { type: QueryTypes.SELECT }
      ) as Promise<any[]>,
      sequelize.query(
        `SELECT
            AVG(EXTRACT(EPOCH FROM (first_response_at - created_at))/3600)
              FILTER (WHERE first_response_at IS NOT NULL) AS avg_resp_hrs,
            AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600)
              FILTER (WHERE resolved_at IS NOT NULL) AS avg_reso_hrs
           FROM hr_queries
          WHERE created_at >= NOW() - INTERVAL '30 days'`,
        { type: QueryTypes.SELECT }
      ) as Promise<any[]>,
      sequelize.query(
        // SLA window: include responded tickets AND tickets still unanswered
        // whose age has already exceeded their SLA target (overdue).
        `SELECT
            COUNT(*) FILTER (
              WHERE first_response_at IS NOT NULL
            )::int AS responded,
            COUNT(*) FILTER (
              WHERE first_response_at IS NOT NULL
                AND EXTRACT(EPOCH FROM (first_response_at - created_at))/3600 <= ${slaCase}
            )::int AS met,
            COUNT(*) FILTER (
              WHERE first_response_at IS NULL
                AND status <> 'closed'
                AND EXTRACT(EPOCH FROM (NOW() - created_at))/3600 > ${slaCase}
            )::int AS overdue
           FROM hr_queries
          WHERE created_at >= NOW() - INTERVAL '30 days'`,
        { type: QueryTypes.SELECT }
      ) as Promise<any[]>,
      sequelize.query(
        `SELECT category, COUNT(*)::int AS count
           FROM hr_queries
          GROUP BY category
          ORDER BY count DESC`,
        { type: QueryTypes.SELECT }
      ) as Promise<any[]>,
      sequelize.query(
        `SELECT priority, COUNT(*)::int AS count
           FROM hr_queries
          WHERE status IN ('open','in_progress')
          GROUP BY priority`,
        { type: QueryTypes.SELECT }
      ) as Promise<any[]>,
      sequelize.query(
        `SELECT q.assigned_to AS "userId",
                u.name AS name,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE q.status IN ('open','in_progress'))::int AS open,
                AVG(EXTRACT(EPOCH FROM (q.first_response_at - q.created_at))/3600)
                  FILTER (
                    WHERE q.first_response_at IS NOT NULL
                      AND q.created_at >= NOW() - INTERVAL '30 days'
                  ) AS avg_resp_hrs
           FROM hr_queries q
           LEFT JOIN users u ON u.id = q.assigned_to
          WHERE q.assigned_to IS NOT NULL
          GROUP BY q.assigned_to, u.name
          ORDER BY total DESC
          LIMIT 20`,
        { type: QueryTypes.SELECT }
      ) as Promise<any[]>,
      sequelize.query(
        `WITH days AS (
           SELECT generate_series(
             (DATE_TRUNC('day', NOW()) - INTERVAL '13 days')::date,
             DATE_TRUNC('day', NOW())::date,
             INTERVAL '1 day'
           )::date AS day
         ),
         c AS (
           SELECT DATE_TRUNC('day', created_at)::date AS day, COUNT(*)::int AS n
             FROM hr_queries
            WHERE created_at >= DATE_TRUNC('day', NOW()) - INTERVAL '13 days'
            GROUP BY 1
         ),
         r AS (
           SELECT DATE_TRUNC('day', resolved_at)::date AS day, COUNT(*)::int AS n
             FROM hr_queries
            WHERE resolved_at IS NOT NULL
              AND resolved_at >= DATE_TRUNC('day', NOW()) - INTERVAL '13 days'
            GROUP BY 1
         )
         SELECT TO_CHAR(d.day, 'YYYY-MM-DD') AS day,
                COALESCE(c.n, 0)::int AS created,
                COALESCE(r.n, 0)::int AS resolved
           FROM days d
           LEFT JOIN c USING (day)
           LEFT JOIN r USING (day)
          ORDER BY d.day`,
        { type: QueryTypes.SELECT }
      ) as Promise<any[]>,
    ]);

    const t = (totalsRows[0] ?? {}) as any;
    const w = (windowedRows[0] ?? {}) as any;
    const s = (slaRows[0] ?? { responded: 0, met: 0, overdue: 0 }) as any;
    const slaConsidered = (s.responded ?? 0) + (s.overdue ?? 0);

    const openByPriority = ["high", "normal", "low"].map(p => {
      const found = openByPriorityRows.find((r: any) => r.priority === p);
      return { priority: p, count: found ? Number(found.count) : 0 };
    });

    const byAssignee = assigneeRows.map((r: any) => ({
      userId: r.userId,
      name: r.name ?? `User #${r.userId}`,
      open: Number(r.open),
      total: Number(r.total),
      avgResponseHours: r.avg_resp_hrs != null ? Number(r.avg_resp_hrs) : null,
    }));

    return {
      totals: {
        all: t.all_count ?? 0,
        open: t.open_c ?? 0,
        in_progress: t.in_progress_c ?? 0,
        resolved: t.resolved_c ?? 0,
        closed: t.closed_c ?? 0,
        escalated: t.escalated_c ?? 0,
        createdToday: t.today_c ?? 0,
        createdWeek: t.week_c ?? 0,
      },
      avgResponseHours: w.avg_resp_hrs != null ? Number(w.avg_resp_hrs) : null,
      avgResolutionHours: w.avg_reso_hrs != null ? Number(w.avg_reso_hrs) : null,
      slaCompliance: slaConsidered > 0 ? Number(s.met) / slaConsidered : null,
      slaWindow: { sampleSize: slaConsidered, met: Number(s.met ?? 0), overdue: Number(s.overdue ?? 0) },
      byCategory: categoryRows.map((r: any) => ({ category: r.category, count: Number(r.count) })),
      byAssignee,
      openByPriority,
      trend: trendRows.map((r: any) => ({ day: r.day, created: Number(r.created), resolved: Number(r.resolved) })),
    };
  }
}
