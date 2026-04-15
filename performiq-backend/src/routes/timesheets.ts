import { Router } from "express";
import { db, timesheetsTable, timesheetEntriesTable, timesheetApproversTable, usersTable } from "../db/index.js";
import { eq, and, desc, inArray, asc, ne } from "drizzle-orm";
import { requireAuth, requireRole, AuthRequest } from "../middlewares/auth.js";

const router = Router();

function getWeekBounds(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    weekStart: monday.toISOString().split("T")[0],
    weekEnd: sunday.toISOString().split("T")[0],
  };
}

async function getApproversForSheet(timesheetId: number) {
  const rows = await db.select().from(timesheetApproversTable)
    .where(eq(timesheetApproversTable.timesheetId, timesheetId))
    .orderBy(asc(timesheetApproversTable.orderIndex));
  if (rows.length === 0) return [];
  const approverUsers = await db.select({
    id: usersTable.id, name: usersTable.name, email: usersTable.email,
    department: usersTable.department, role: usersTable.role,
  }).from(usersTable).where(inArray(usersTable.id, rows.map(r => r.approverId)));
  const userMap = Object.fromEntries(approverUsers.map(u => [u.id, u]));
  return rows.map(row => ({
    id: row.id,
    approverId: row.approverId,
    orderIndex: row.orderIndex,
    status: row.status,
    note: row.note,
    reviewedAt: row.reviewedAt,
    approver: userMap[row.approverId] ?? null,
  }));
}

async function enrichSheet(sheet: any) {
  const entries = await db.select().from(timesheetEntriesTable)
    .where(eq(timesheetEntriesTable.timesheetId, sheet.id));
  const approvers = await getApproversForSheet(sheet.id);
  const currentApprover = approvers.find(a => a.status === "pending") ?? null;
  return { ...sheet, entries, approvers, currentApproverId: currentApprover?.approverId ?? null };
}

// GET /timesheets/approvers — list all managers/admins that can be chosen as approvers
router.get("/timesheets/approvers", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id: selfId } = req.user!;
    const managers = await db.select({
      id: usersTable.id, name: usersTable.name, email: usersTable.email,
      role: usersTable.role, department: usersTable.department, siteId: usersTable.siteId,
    }).from(usersTable)
      .where(and(
        inArray(usersTable.role, ["manager", "admin", "super_admin"] as any),
        ne(usersTable.id, selfId),
      ));
    res.json(managers);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch approvers" });
  }
});

// GET /timesheets — list timesheets
router.get("/timesheets", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: userId } = req.user!;
    let rows = await db.select().from(timesheetsTable).orderBy(desc(timesheetsTable.weekStart));

    if (role === "employee") {
      rows = rows.filter(r => r.userId === userId);
    } else if (role === "manager") {
      const subs = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.managerId, userId));
      const allowedIds = new Set([userId, ...subs.map(s => s.id)]);
      // Also include timesheets where this manager is in the approver chain
      const approverRows = await db.select({ timesheetId: timesheetApproversTable.timesheetId })
        .from(timesheetApproversTable).where(eq(timesheetApproversTable.approverId, userId));
      const approverSheetIds = new Set(approverRows.map(a => a.timesheetId));
      rows = rows.filter(r => allowedIds.has(r.userId) || approverSheetIds.has(r.id));
    }

    const userIds = [...new Set(rows.map(r => r.userId))];
    const users = userIds.length > 0
      ? await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, department: usersTable.department })
          .from(usersTable).where(inArray(usersTable.id, userIds))
      : [];
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    // Enrich with approver chains
    const enriched = await Promise.all(rows.map(async r => {
      const approvers = await getApproversForSheet(r.id);
      const currentApprover = approvers.find(a => a.status === "pending") ?? null;
      return { ...r, user: userMap[r.userId] ?? null, approvers, currentApproverId: currentApprover?.approverId ?? null };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch timesheets" });
  }
});

// GET /timesheets/current — current user's timesheet for this week
router.get("/timesheets/current", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { weekStart, weekEnd } = getWeekBounds(new Date());
    let [sheet] = await db.select().from(timesheetsTable)
      .where(and(eq(timesheetsTable.userId, userId), eq(timesheetsTable.weekStart, weekStart)));
    if (!sheet) {
      [sheet] = await db.insert(timesheetsTable).values({ userId, weekStart, weekEnd, totalMinutes: 0 }).returning();
    }
    res.json(await enrichSheet(sheet));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch current timesheet" });
  }
});

// GET /timesheets/week?date=YYYY-MM-DD — get or create timesheet for any week (up to 3 months back)
router.get("/timesheets/week", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const dateParam = typeof req.query.date === "string" ? req.query.date : null;
    const targetDate = dateParam ? new Date(dateParam + "T00:00:00") : new Date();

    const limitDate = new Date();
    limitDate.setMonth(limitDate.getMonth() - 3);
    limitDate.setDate(1);
    if (targetDate < limitDate) {
      res.status(400).json({ error: "Cannot access timesheets older than 3 months" }); return;
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (targetDate > tomorrow) {
      res.status(400).json({ error: "Cannot access future timesheets" }); return;
    }

    const { weekStart, weekEnd } = getWeekBounds(targetDate);
    let [sheet] = await db.select().from(timesheetsTable)
      .where(and(eq(timesheetsTable.userId, userId), eq(timesheetsTable.weekStart, weekStart)));
    if (!sheet) {
      [sheet] = await db.insert(timesheetsTable).values({ userId, weekStart, weekEnd, totalMinutes: 0 }).returning();
    }
    res.json(await enrichSheet(sheet));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch timesheet for week" });
  }
});

// GET /timesheets/:id — get timesheet with entries and approvers
router.get("/timesheets/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id: userId, role } = req.user!;
    const id = parseInt(req.params.id);
    const [sheet] = await db.select().from(timesheetsTable).where(eq(timesheetsTable.id, id));
    if (!sheet) return res.status(404).json({ error: "Not found" });
    if (role === "employee" && sheet.userId !== userId) return res.status(403).json({ error: "Forbidden" });
    if (role === "manager") {
      const subs = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.managerId, userId));
      const allowedIds = new Set([userId, ...subs.map(s => s.id)]);
      // Also allow if this manager is an approver for this sheet
      const approverRow = await db.select({ id: timesheetApproversTable.id })
        .from(timesheetApproversTable)
        .where(and(eq(timesheetApproversTable.timesheetId, id), eq(timesheetApproversTable.approverId, userId)))
        .limit(1);
      if (!allowedIds.has(sheet.userId) && approverRow.length === 0) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }
    const [user] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, sheet.userId));
    const enriched = await enrichSheet(sheet);
    res.json({ ...enriched, user: user ?? null });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch timesheet" });
  }
});

// PUT /timesheets/:id/entries — upsert a day's entry
router.put("/timesheets/:id/entries", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const timesheetId = parseInt(req.params.id);
    const { date, minutes, notes } = req.body;
    const [sheet] = await db.select().from(timesheetsTable).where(eq(timesheetsTable.id, timesheetId));
    if (!sheet || sheet.userId !== userId) return res.status(403).json({ error: "Forbidden" });
    if (sheet.status !== "draft" && sheet.status !== "rejected") {
      return res.status(400).json({ error: "Cannot edit a submitted or approved timesheet" });
    }

    const [existing] = await db.select().from(timesheetEntriesTable)
      .where(and(eq(timesheetEntriesTable.timesheetId, timesheetId), eq(timesheetEntriesTable.date, date)));

    let entry;
    if (existing) {
      [entry] = await db.update(timesheetEntriesTable)
        .set({ minutes: minutes ?? 0, notes })
        .where(eq(timesheetEntriesTable.id, existing.id)).returning();
    } else {
      [entry] = await db.insert(timesheetEntriesTable)
        .values({ timesheetId, userId, date, minutes: minutes ?? 0, notes }).returning();
    }

    const allEntries = await db.select().from(timesheetEntriesTable).where(eq(timesheetEntriesTable.timesheetId, timesheetId));
    const totalMinutes = allEntries.reduce((sum, e) => sum + (e.minutes ?? 0), 0);
    await db.update(timesheetsTable).set({ totalMinutes, updatedAt: new Date() }).where(eq(timesheetsTable.id, timesheetId));

    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: "Failed to save entry" });
  }
});

// POST /timesheets/:id/submit — submit with optional ordered approver chain
router.post("/timesheets/:id/submit", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const id = parseInt(req.params.id);
    const { approverIds } = req.body; // array of user IDs in approval order

    const [sheet] = await db.select().from(timesheetsTable).where(eq(timesheetsTable.id, id));
    if (!sheet || sheet.userId !== userId) return res.status(403).json({ error: "Forbidden" });
    if (sheet.status !== "draft" && sheet.status !== "rejected") {
      return res.status(400).json({ error: "Already submitted" });
    }

    // Clear any old approvers (in case of resubmit after rejection)
    await db.delete(timesheetApproversTable).where(eq(timesheetApproversTable.timesheetId, id));

    // Build approver chain
    let orderedIds: number[] = Array.isArray(approverIds) && approverIds.length > 0
      ? approverIds.map(Number).filter(Boolean)
      : [];

    // Default: employee's direct manager if none selected
    if (orderedIds.length === 0) {
      const [emp] = await db.select({ managerId: usersTable.managerId }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      if (emp?.managerId) orderedIds = [emp.managerId];
    }

    if (orderedIds.length > 0) {
      await db.insert(timesheetApproversTable).values(
        orderedIds.map((aid, idx) => ({
          timesheetId: id,
          approverId: aid,
          orderIndex: idx,
          status: "pending",
        }))
      );
    }

    const [updated] = await db.update(timesheetsTable)
      .set({ status: "submitted", submittedAt: new Date(), approvedBy: null, approvedAt: null, updatedAt: new Date() })
      .where(eq(timesheetsTable.id, id)).returning();

    res.json(await enrichSheet(updated));
  } catch (err) {
    res.status(500).json({ error: "Failed to submit" });
  }
});

// POST /timesheets/:id/approve — sequential: mark current approver done, advance or fully approve
router.post("/timesheets/:id/approve", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id: approverId, role } = req.user!;
    if (role === "employee") return res.status(403).json({ error: "Forbidden" });
    const id = parseInt(req.params.id);

    const [sheet] = await db.select().from(timesheetsTable).where(eq(timesheetsTable.id, id));
    if (!sheet) return res.status(404).json({ error: "Not found" });
    if (sheet.status !== "submitted") return res.status(400).json({ error: "Timesheet is not submitted" });

    // Find the current pending approver
    const [currentStep] = await db.select().from(timesheetApproversTable)
      .where(and(eq(timesheetApproversTable.timesheetId, id), eq(timesheetApproversTable.status, "pending")))
      .orderBy(asc(timesheetApproversTable.orderIndex)).limit(1);

    const isAdmin = role === "admin" || role === "super_admin";
    const isCurrentApprover = currentStep && currentStep.approverId === approverId;

    if (!isAdmin && !isCurrentApprover) {
      return res.status(403).json({ error: "You are not the current approver for this timesheet" });
    }

    // Mark current step approved
    if (currentStep) {
      await db.update(timesheetApproversTable)
        .set({ status: "approved", reviewedAt: new Date() })
        .where(eq(timesheetApproversTable.id, currentStep.id));
    }

    // Check if more pending approvers remain
    const [nextStep] = await db.select().from(timesheetApproversTable)
      .where(and(eq(timesheetApproversTable.timesheetId, id), eq(timesheetApproversTable.status, "pending")))
      .orderBy(asc(timesheetApproversTable.orderIndex)).limit(1);

    let updated;
    if (nextStep) {
      // Still more approvers — stay submitted, just advance
      [updated] = await db.update(timesheetsTable)
        .set({ updatedAt: new Date() })
        .where(eq(timesheetsTable.id, id)).returning();
    } else {
      // All approved — fully approve
      [updated] = await db.update(timesheetsTable)
        .set({ status: "approved", approvedBy: approverId, approvedAt: new Date(), updatedAt: new Date() })
        .where(eq(timesheetsTable.id, id)).returning();
    }

    res.json(await enrichSheet(updated));
  } catch (err) {
    res.status(500).json({ error: "Failed to approve" });
  }
});

// POST /timesheets/:id/reject
router.post("/timesheets/:id/reject", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id: rejectorId, role } = req.user!;
    if (role === "employee") return res.status(403).json({ error: "Forbidden" });
    const { notes } = req.body;
    const id = parseInt(req.params.id);

    const [sheet] = await db.select().from(timesheetsTable).where(eq(timesheetsTable.id, id));
    if (!sheet) return res.status(404).json({ error: "Not found" });

    // Find current pending step and mark rejected
    const [currentStep] = await db.select().from(timesheetApproversTable)
      .where(and(eq(timesheetApproversTable.timesheetId, id), eq(timesheetApproversTable.status, "pending")))
      .orderBy(asc(timesheetApproversTable.orderIndex)).limit(1);

    const isAdmin = role === "admin" || role === "super_admin";
    const isCurrentApprover = currentStep && currentStep.approverId === rejectorId;

    if (!isAdmin && !isCurrentApprover) {
      return res.status(403).json({ error: "You are not the current approver for this timesheet" });
    }

    if (currentStep) {
      await db.update(timesheetApproversTable)
        .set({ status: "rejected", note: notes || null, reviewedAt: new Date() })
        .where(eq(timesheetApproversTable.id, currentStep.id));
    }

    const [updated] = await db.update(timesheetsTable)
      .set({ status: "rejected", rejectedBy: rejectorId, rejectedAt: new Date(), notes, updatedAt: new Date() })
      .where(eq(timesheetsTable.id, id)).returning();

    res.json(await enrichSheet(updated));
  } catch (err) {
    res.status(500).json({ error: "Failed to reject" });
  }
});

export default router;
