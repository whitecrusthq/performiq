import { Router } from "express";
import { db, leaveRequestsTable, leaveApproversTable, leavePoliciesTable, leaveAllocationsTable, leaveTypesTable, usersTable } from "../db/index.js";
import { eq, or, desc, and, asc, inArray, sql } from "drizzle-orm";
import { requireAuth, requireRole, AuthRequest } from "../middlewares/auth.js";
import { sendLeaveNotification } from "../lib/mailgun.js";

function notify(payload: Parameters<typeof sendLeaveNotification>[0]) {
  sendLeaveNotification(payload).catch(err =>
    console.error("[leave notify] Failed to send notification:", err?.message ?? err)
  );
}

const router = Router();

function getCycleKey(policy: { cycleStartMonth: number; cycleStartDay: number; cycleEndMonth: number; cycleEndDay: number }) {
  const today = new Date();
  const year = today.getFullYear();
  const cycleStart = new Date(year, policy.cycleStartMonth - 1, policy.cycleStartDay);
  if (today < cycleStart) {
    return year - 1;
  }
  return year;
}

function getCurrentCycleYear() {
  return new Date().getFullYear();
}

async function ensureAllocation(employeeId: number, leaveType: string, cycleYear?: number) {
  const [policy] = await db.select().from(leavePoliciesTable)
    .where(eq(leavePoliciesTable.leaveType, leaveType as any)).limit(1);

  const effectiveCycle = cycleYear ?? (policy ? getCycleKey(policy) : new Date().getFullYear());
  const allocated = policy ? policy.daysAllocated : 0;
  const policyId = policy ? policy.id : null;

  const existing = await db.select().from(leaveAllocationsTable)
    .where(and(
      eq(leaveAllocationsTable.employeeId, employeeId),
      eq(leaveAllocationsTable.leaveType, leaveType as any),
      eq(leaveAllocationsTable.cycleYear, effectiveCycle)
    )).limit(1);

  if (existing.length > 0) return existing[0];

  const [alloc] = await db.insert(leaveAllocationsTable).values({
    employeeId,
    leaveType: leaveType as any,
    policyId,
    allocated,
    used: 0,
    cycleYear: effectiveCycle,
  }).returning();

  return alloc;
}

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

router.get("/leave-types", async (_req, res) => {
  try {
    const types = await db.select().from(leaveTypesTable).orderBy(asc(leaveTypesTable.name));
    res.json(types);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/leave-types", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { name, label } = req.body;
    if (!name || !label) { res.status(400).json({ error: "Name and label are required" }); return; }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!slug) { res.status(400).json({ error: "Invalid name" }); return; }
    const existing = await db.select().from(leaveTypesTable).where(eq(leaveTypesTable.name, slug)).limit(1);
    if (existing.length > 0) { res.status(400).json({ error: "A leave type with this name already exists" }); return; }
    const [created] = await db.insert(leaveTypesTable).values({ name: slug, label }).returning();
    res.json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/leave-types/:id", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { label } = req.body;
    if (!label) { res.status(400).json({ error: "Label is required" }); return; }
    const [updated] = await db.update(leaveTypesTable).set({ label }).where(eq(leaveTypesTable.id, Number(req.params.id))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/leave-types/:id", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const [row] = await db.select().from(leaveTypesTable).where(eq(leaveTypesTable.id, Number(req.params.id))).limit(1);
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    if (row.isDefault) { res.status(400).json({ error: "Cannot delete a default leave type" }); return; }
    await db.delete(leaveTypesTable).where(eq(leaveTypesTable.id, row.id));
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/leave-policies", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const policies = await db.select().from(leavePoliciesTable).orderBy(asc(leavePoliciesTable.leaveType));
    res.json(policies);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/leave-policies", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { leaveType, daysAllocated, cycleStartMonth, cycleStartDay, cycleEndMonth, cycleEndDay } = req.body;
    if (!leaveType || daysAllocated === undefined) {
      res.status(400).json({ error: "leaveType and daysAllocated are required" }); return;
    }

    const existing = await db.select().from(leavePoliciesTable)
      .where(eq(leavePoliciesTable.leaveType, leaveType)).limit(1);

    let policy;
    if (existing.length > 0) {
      [policy] = await db.update(leavePoliciesTable).set({
        daysAllocated: Number(daysAllocated),
        cycleStartMonth: Number(cycleStartMonth) || 1,
        cycleStartDay: Number(cycleStartDay) || 1,
        cycleEndMonth: Number(cycleEndMonth) || 12,
        cycleEndDay: Number(cycleEndDay) || 31,
        updatedAt: new Date(),
      }).where(eq(leavePoliciesTable.id, existing[0].id)).returning();
    } else {
      [policy] = await db.insert(leavePoliciesTable).values({
        leaveType,
        daysAllocated: Number(daysAllocated),
        cycleStartMonth: Number(cycleStartMonth) || 1,
        cycleStartDay: Number(cycleStartDay) || 1,
        cycleEndMonth: Number(cycleEndMonth) || 12,
        cycleEndDay: Number(cycleEndDay) || 31,
      }).returning();
    }

    const cycleYear = getCycleKey(policy);
    const employees = await db.select({ id: usersTable.id }).from(usersTable);
    for (const emp of employees) {
      const existingAlloc = await db.select().from(leaveAllocationsTable)
        .where(and(
          eq(leaveAllocationsTable.employeeId, emp.id),
          eq(leaveAllocationsTable.leaveType, leaveType),
          eq(leaveAllocationsTable.cycleYear, cycleYear)
        )).limit(1);

      if (existingAlloc.length > 0) {
        await db.update(leaveAllocationsTable).set({
          allocated: Number(daysAllocated),
          policyId: policy.id,
          updatedAt: new Date(),
        }).where(eq(leaveAllocationsTable.id, existingAlloc[0].id));
      } else {
        await db.insert(leaveAllocationsTable).values({
          employeeId: emp.id,
          leaveType,
          policyId: policy.id,
          allocated: Number(daysAllocated),
          used: 0,
          cycleYear,
        });
      }
    }

    res.json(policy);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/leave-policies/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    await db.delete(leavePoliciesTable).where(eq(leavePoliciesTable.id, Number(req.params.id)));
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/leave-balance", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id: userId } = req.user!;

    const policies = await db.select().from(leavePoliciesTable);
    const policyMap = Object.fromEntries(policies.map(p => [p.leaveType, p]));

    for (const p of policies) {
      await ensureAllocation(userId, p.leaveType);
    }

    const cycleKeys = [...new Set(policies.map(p => getCycleKey(p)))];
    if (cycleKeys.length === 0) cycleKeys.push(new Date().getFullYear());

    const allAllocations = [];
    for (const ck of cycleKeys) {
      const rows = await db.select().from(leaveAllocationsTable)
        .where(and(
          eq(leaveAllocationsTable.employeeId, userId),
          eq(leaveAllocationsTable.cycleYear, ck)
        ));
      allAllocations.push(...rows);
    }

    const seen = new Set<string>();
    const dedupedAllocations = allAllocations.filter(a => {
      const key = a.leaveType;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const balances = dedupedAllocations.map(a => ({
      leaveType: a.leaveType,
      allocated: a.allocated,
      used: a.used,
      remaining: a.allocated - a.used,
      policy: policyMap[a.leaveType] || null,
      cycleYear: a.cycleYear,
    }));

    res.json({ cycleYear: cycleKeys[0], balances });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/leave-balance/team", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id: userId, role } = req.user!;
    const policies = await db.select().from(leavePoliciesTable);
    const policyMap = Object.fromEntries(policies.map(p => [p.leaveType, p]));
    const cycleKeys = [...new Set(policies.map(p => getCycleKey(p)))];
    if (cycleKeys.length === 0) cycleKeys.push(new Date().getFullYear());
    const cycleYear = cycleKeys[0];

    let employeeIds: number[];
    if (role === "admin" || role === "super_admin") {
      const allEmployees = await db.select({ id: usersTable.id }).from(usersTable);
      employeeIds = allEmployees.map(e => e.id);
    } else if (role === "manager") {
      const team = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.managerId, userId));
      employeeIds = [userId, ...team.map(t => t.id)];
    } else {
      employeeIds = [userId];
    }

    if (employeeIds.length === 0) {
      res.json({ cycleYear, employees: [] }); return;
    }

    for (const empId of employeeIds) {
      for (const p of policies) {
        await ensureAllocation(empId, p.leaveType);
      }
    }

    const users = await db.select({ id: usersTable.id, name: usersTable.name, department: usersTable.department, jobTitle: usersTable.jobTitle })
      .from(usersTable).where(inArray(usersTable.id, employeeIds));

    const allAllocations = [];
    for (const ck of cycleKeys) {
      const rows = await db.select().from(leaveAllocationsTable)
        .where(and(
          inArray(leaveAllocationsTable.employeeId, employeeIds),
          eq(leaveAllocationsTable.cycleYear, ck)
        ));
      allAllocations.push(...rows);
    }

    const employeeBalances = users.map(u => {
      const empAllocs = allAllocations.filter(a => a.employeeId === u.id);
      const seen = new Set<string>();
      const deduped = empAllocs.filter(a => {
        if (seen.has(a.leaveType)) return false;
        seen.add(a.leaveType);
        return true;
      });
      return {
        ...u,
        balances: deduped.map(a => ({
          leaveType: a.leaveType,
          allocated: a.allocated,
          used: a.used,
          remaining: a.allocated - a.used,
          policy: policyMap[a.leaveType] || null,
        })),
      };
    });

    res.json({ cycleYear, employees: employeeBalances });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/leave-requests", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id } = req.user!;
    const department = req.query.department as string | undefined;
    const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;

    let rows = await db.select().from(leaveRequestsTable).orderBy(desc(leaveRequestsTable.createdAt));

    if (role === "employee") {
      rows = rows.filter(r => r.employeeId === id);
    } else if (role === "manager") {
      const subordinates = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.managerId, id));
      const subIds = new Set([id, ...subordinates.map(s => s.id)]);
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

    if (department) {
      rows = rows.filter(r => {
        const emp = userMap[r.employeeId];
        return emp && emp.department === department;
      });
    }

    if (employeeId) {
      rows = rows.filter(r => r.employeeId === employeeId);
    }

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

    let orderedApproverIds: number[] = Array.isArray(approverIds) && approverIds.length > 0
      ? approverIds.map(Number).filter(Boolean)
      : [];

    if (orderedApproverIds.length === 0) {
      const [emp] = await db.select({ managerId: usersTable.managerId }).from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
      if (emp?.managerId) orderedApproverIds = [emp.managerId];
    }

    if (orderedApproverIds.length > 0) {
      await db.insert(leaveApproversTable).values(
        orderedApproverIds.map((aid, idx) => ({
          leaveRequestId: row.id,
          approverId: aid,
          orderIndex: idx,
          status: 'pending',
        }))
      ).onConflictDoNothing();
      await db.update(leaveRequestsTable).set({ reviewerId: orderedApproverIds[0] }).where(eq(leaveRequestsTable.id, row.id));
    }

    const allIds = [req.user!.id, ...orderedApproverIds];
    const users = await db.select().from(usersTable).where(inArray(usersTable.id, allIds));
    const userMap: Record<number, any> = {};
    users.forEach(u => { userMap[u.id] = u; });

    const enriched = await enrichLeaveRequest(row, userMap);

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
    if (role === "manager") {
      const team = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.managerId, id));
      const teamIds = new Set(team.map(t => t.id));
      const approvers = await db.select().from(leaveApproversTable).where(eq(leaveApproversTable.leaveRequestId, row.id));
      const isInChain = approvers.some(a => a.approverId === id);
      if (row.employeeId !== id && !teamIds.has(row.employeeId) && !isInChain) {
        res.status(403).json({ error: "Forbidden" }); return;
      }
    }
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

      if (row.status === "approved") {
        const alloc = await ensureAllocation(row.employeeId, row.leaveType);
        await db.update(leaveAllocationsTable).set({
          used: Math.max(0, alloc.used - row.days),
          updatedAt: new Date(),
        }).where(eq(leaveAllocationsTable.id, alloc.id));
      }

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

      const approverRows = await db.select().from(leaveApproversTable)
        .where(and(eq(leaveApproversTable.leaveRequestId, row.id), eq(leaveApproversTable.status, 'pending')))
        .orderBy(asc(leaveApproversTable.orderIndex))
        .limit(1);

      const isAdmin = role === "admin" || role === "super_admin";
      const isCurrentApprover = approverRows.length > 0 && approverRows[0].approverId === id;
      if (!isAdmin && !isCurrentApprover) {
        res.status(403).json({ error: "You are not the current approver for this request" }); return;
      }

      const [empUser] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
        .from(usersTable).where(eq(usersTable.id, row.employeeId)).limit(1);

      if (status === "rejected") {
        if (approverRows.length > 0) {
          await db.update(leaveApproversTable)
            .set({ status: 'rejected', note: reviewNote || null, reviewedAt: new Date() })
            .where(eq(leaveApproversTable.id, approverRows[0].id));
        }
        const [updated] = await db.update(leaveRequestsTable)
          .set({ status: "rejected", reviewerId: id, reviewNote: reviewNote || null, updatedAt: new Date() })
          .where(eq(leaveRequestsTable.id, row.id)).returning();

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

      if (approverRows.length > 0) {
        await db.update(leaveApproversTable)
          .set({ status: 'approved', note: reviewNote || null, reviewedAt: new Date() })
          .where(eq(leaveApproversTable.id, approverRows[0].id));
      }

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

      if (finalStatus === "approved") {
        const alloc = await ensureAllocation(row.employeeId, row.leaveType);
        await db.update(leaveAllocationsTable).set({
          used: alloc.used + row.days,
          updatedAt: new Date(),
        }).where(eq(leaveAllocationsTable.id, alloc.id));
      }

      const employeeName = empUser?.name ?? empUser?.email ?? "An employee";

      if (finalStatus === "approved") {
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
