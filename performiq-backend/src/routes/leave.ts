import { Router } from "express";
import { db, leaveRequestsTable, leaveApproversTable, usersTable } from "../db/index.js";
import { eq, or, desc, and, asc, inArray } from "drizzle-orm";
import { requireAuth, requireRole, AuthRequest } from "../middlewares/auth.js";
import { sendLeaveNotification } from "../lib/mailgun.js";

function notify(payload: Parameters<typeof sendLeaveNotification>[0]) {
  sendLeaveNotification(payload).catch(err =>
    console.error("[leave notify] Failed to send notification:", err?.message ?? err)
  );
}

const router = Router();

async function getApproversForRequest(leaveRequestId: number) {
  const rows = await db.select().from(leaveApproversTable)
    .where(eq(leaveApproversTable.leaveRequestId, leaveRequestId))
    .orderBy(asc(leaveApproversTable.orderIndex));
  if (rows.length === 0) return [];
  const approverUsers = await db.select().from(usersTable)
    .where(inArray(usersTable.id, rows.map(r => r.approverId)));
  const userMap = Object.fromEntries(approverUsers.map(u => [u.id, { id: u.id, name: u.name, email: u.email, department: u.department, jobTitle: u.jobTitle }]));
  return rows.map(row => ({
    id: row.approverId,
    orderIndex: row.orderIndex,
    status: row.status,
    note: row.note,
    reviewedAt: row.reviewedAt,
    approver: userMap[row.approverId] ?? null,
  }));
}

async function enrichLeaveRequest(r: typeof leaveRequestsTable.$inferSelect, userMap: Record<number, any>) {
  const approvers = await getApproversForRequest(r.id);
  const currentApprover = approvers.find(a => a.status === 'pending') ?? null;
  return {
    ...r,
    employee: userMap[r.employeeId] ?? null,
    reviewer: r.reviewerId ? (userMap[r.reviewerId] ?? null) : null,
    approvers,
    currentApproverId: currentApprover?.id ?? null,
  };
}

router.get("/leave-requests", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id } = req.user!;
    let rows = await db.select().from(leaveRequestsTable).orderBy(desc(leaveRequestsTable.createdAt));

    if (role === "employee") {
      rows = rows.filter(r => r.employeeId === id);
    } else if (role === "manager") {
      const subordinates = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.managerId, id));
      const subIds = new Set([id, ...subordinates.map(s => s.id)]);
      // Also show requests where this manager is an approver
      const approverRows = await db.select({ leaveRequestId: leaveApproversTable.leaveRequestId })
        .from(leaveApproversTable).where(eq(leaveApproversTable.approverId, id));
      const approverRequestIds = new Set(approverRows.map(a => a.leaveRequestId));
      rows = rows.filter(r => subIds.has(r.employeeId) || approverRequestIds.has(r.id));
    }

    const allUserIds = [...new Set([
      ...rows.map(r => r.employeeId),
      ...rows.map(r => r.reviewerId).filter(Boolean) as number[],
    ])];
    const users = allUserIds.length > 0
      ? await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, department: usersTable.department, jobTitle: usersTable.jobTitle })
          .from(usersTable).where(or(...allUserIds.map(uid => eq(usersTable.id, uid))))
      : [];
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const enriched = await Promise.all(rows.map(r => enrichLeaveRequest(r, userMap)));
    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/leave-requests", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { leaveType, startDate, endDate, days, reason, approverIds } = req.body;
    if (!leaveType || !startDate || !endDate || !days) {
      res.status(400).json({ error: "leaveType, startDate, endDate, and days are required" }); return;
    }

    const [row] = await db.insert(leaveRequestsTable).values({
      employeeId: req.user!.id,
      leaveType,
      startDate,
      endDate,
      days: Number(days),
      reason: reason || null,
      status: "pending",
    }).returning();

    // Build approver chain: use provided approverIds or default to employee's manager
    let orderedApproverIds: number[] = Array.isArray(approverIds) && approverIds.length > 0
      ? approverIds.map(Number).filter(Boolean)
      : [];

    if (orderedApproverIds.length === 0) {
      // Default: auto-assign the employee's direct manager
      const [emp] = await db.select({ managerId: usersTable.managerId }).from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
      if (emp?.managerId) orderedApproverIds = [emp.managerId];
    }

    if (orderedApproverIds.length > 0) {
      await db.insert(leaveApproversTable).values(
        orderedApproverIds.map((aid, idx) => ({
          leaveRequestId: row.id,
          approverId: aid,
          orderIndex: idx,
          status: idx === 0 ? 'pending' : 'pending', // all start pending, first is active
        }))
      ).onConflictDoNothing();
      // Also update legacy reviewerId to first approver
      await db.update(leaveRequestsTable).set({ reviewerId: orderedApproverIds[0] }).where(eq(leaveRequestsTable.id, row.id));
    }

    const allIds = [req.user!.id, ...orderedApproverIds];
    const users = await db.select().from(usersTable).where(inArray(usersTable.id, allIds));
    const userMap: Record<number, any> = {};
    users.forEach(u => { userMap[u.id] = u; });

    const enriched = await enrichLeaveRequest(row, userMap);

    // Notify the first approver that a leave request awaits their review
    if (orderedApproverIds.length > 0) {
      const firstApprover = userMap[orderedApproverIds[0]];
      const employee = userMap[req.user!.id];
      if (firstApprover?.email) {
        notify({
          event: "submitted",
          to: firstApprover.email,
          recipientName: firstApprover.name ?? firstApprover.email,
          employeeName: employee?.name ?? employee?.email ?? "An employee",
          leaveType: row.leaveType,
          startDate: row.startDate,
          endDate: row.endDate,
          days: row.days,
        });
      }
    }

    res.status(201).json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/leave-requests/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [row] = await db.select().from(leaveRequestsTable).where(eq(leaveRequestsTable.id, Number(req.params.id)));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    const { role, id } = req.user!;
    if (role === "employee" && row.employeeId !== id) { res.status(403).json({ error: "Forbidden" }); return; }
    const userMap: Record<number, any> = {};
    const users = await db.select().from(usersTable).where(eq(usersTable.id, row.employeeId));
    users.forEach(u => { userMap[u.id] = u; });
    res.json(await enrichLeaveRequest(row, userMap));
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/leave-requests/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id } = req.user!;
    const [row] = await db.select().from(leaveRequestsTable).where(eq(leaveRequestsTable.id, Number(req.params.id)));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    const { status, reviewNote } = req.body;

    if (status === "cancelled") {
      if (row.employeeId !== id) { res.status(403).json({ error: "Only the applicant can cancel" }); return; }
      if (row.status !== "pending") { res.status(400).json({ error: "Only pending requests can be cancelled" }); return; }
      const [updated] = await db.update(leaveRequestsTable)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(leaveRequestsTable.id, row.id)).returning();
      const userMap: Record<number, any> = {};
      res.json(await enrichLeaveRequest(updated, userMap));
      return;
    }

    if (status === "approved" || status === "rejected") {
      const ROLE_LEVEL: Record<string, number> = { super_admin: 4, admin: 3, manager: 2, employee: 1 };
      if ((ROLE_LEVEL[role] ?? 1) < 2) { res.status(403).json({ error: "Insufficient permissions" }); return; }
      if (row.status !== "pending") { res.status(400).json({ error: "Only pending requests can be reviewed" }); return; }

      // Find the current approver for this request (first pending in chain)
      const approverRows = await db.select().from(leaveApproversTable)
        .where(and(eq(leaveApproversTable.leaveRequestId, row.id), eq(leaveApproversTable.status, 'pending')))
        .orderBy(asc(leaveApproversTable.orderIndex))
        .limit(1);

      // Check authorization: user must be the current pending approver, or admin/super_admin
      const isAdmin = role === "admin" || role === "super_admin";
      const isCurrentApprover = approverRows.length > 0 && approverRows[0].approverId === id;
      if (!isAdmin && !isCurrentApprover) {
        res.status(403).json({ error: "You are not the current approver for this request" }); return;
      }

      // Fetch employee details for notifications
      const [empUser] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
        .from(usersTable).where(eq(usersTable.id, row.employeeId)).limit(1);

      if (status === "rejected") {
        // Rejection finalizes immediately, mark current approver as rejected
        if (approverRows.length > 0) {
          await db.update(leaveApproversTable)
            .set({ status: 'rejected', note: reviewNote || null, reviewedAt: new Date() })
            .where(eq(leaveApproversTable.id, approverRows[0].id));
        }
        const [updated] = await db.update(leaveRequestsTable)
          .set({ status: "rejected", reviewerId: id, reviewNote: reviewNote || null, updatedAt: new Date() })
          .where(eq(leaveRequestsTable.id, row.id)).returning();

        // Notify employee that their request was rejected
        if (empUser?.email) {
          notify({
            event: "rejected",
            to: empUser.email,
            recipientName: empUser.name ?? empUser.email,
            employeeName: empUser.name ?? empUser.email,
            leaveType: row.leaveType,
            startDate: row.startDate,
            endDate: row.endDate,
            days: row.days,
            reviewerNote: reviewNote || undefined,
          });
        }

        const userMap: Record<number, any> = {};
        res.json(await enrichLeaveRequest(updated, userMap));
        return;
      }

      // Approved — mark current approver, check if more remain
      if (approverRows.length > 0) {
        await db.update(leaveApproversTable)
          .set({ status: 'approved', note: reviewNote || null, reviewedAt: new Date() })
          .where(eq(leaveApproversTable.id, approverRows[0].id));
      }

      // Check if there are more pending approvers
      const remaining = await db.select().from(leaveApproversTable)
        .where(and(eq(leaveApproversTable.leaveRequestId, row.id), eq(leaveApproversTable.status, 'pending')))
        .orderBy(asc(leaveApproversTable.orderIndex))
        .limit(1);

      let finalStatus: "pending" | "approved" = remaining.length > 0 ? "pending" : "approved";
      const nextApproverId = remaining.length > 0 ? remaining[0].approverId : null;

      const [updated] = await db.update(leaveRequestsTable)
        .set({
          status: finalStatus,
          reviewerId: nextApproverId ?? id,
          reviewNote: finalStatus === "approved" ? (reviewNote || null) : null,
          updatedAt: new Date(),
        })
        .where(eq(leaveRequestsTable.id, row.id)).returning();

      const employeeName = empUser?.name ?? empUser?.email ?? "An employee";

      if (finalStatus === "approved") {
        // Fully approved — notify the employee
        if (empUser?.email) {
          notify({
            event: "approved",
            to: empUser.email,
            recipientName: empUser.name ?? empUser.email,
            employeeName,
            leaveType: row.leaveType,
            startDate: row.startDate,
            endDate: row.endDate,
            days: row.days,
            reviewerNote: reviewNote || undefined,
          });
        }
      } else if (nextApproverId) {
        // Still pending — notify the next approver in the chain
        const [nextApprover] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
          .from(usersTable).where(eq(usersTable.id, nextApproverId)).limit(1);
        if (nextApprover?.email) {
          notify({
            event: "awaiting_next",
            to: nextApprover.email,
            recipientName: nextApprover.name ?? nextApprover.email,
            employeeName,
            leaveType: row.leaveType,
            startDate: row.startDate,
            endDate: row.endDate,
            days: row.days,
          });
        }
      }

      const userMap: Record<number, any> = {};
      res.json(await enrichLeaveRequest(updated, userMap));
      return;
    }

    res.status(400).json({ error: "Invalid status" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/leave-requests/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    await db.delete(leaveRequestsTable).where(eq(leaveRequestsTable.id, Number(req.params.id)));
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
