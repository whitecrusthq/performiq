import { Router } from "express";
import { db, timesheetsTable, timesheetEntriesTable, usersTable } from "../db/index.js";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";

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
      rows = rows.filter(r => allowedIds.has(r.userId));
    }

    const userIds = [...new Set(rows.map(r => r.userId))];
    const users = userIds.length > 0
      ? await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, department: usersTable.department })
          .from(usersTable).where(inArray(usersTable.id, userIds))
      : [];
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    res.json(rows.map(r => ({ ...r, user: userMap[r.userId] ?? null })));
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
    const entries = await db.select().from(timesheetEntriesTable).where(eq(timesheetEntriesTable.timesheetId, sheet.id));
    res.json({ ...sheet, entries });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch current timesheet" });
  }
});

// GET /timesheets/:id — get timesheet with entries
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
      if (!allowedIds.has(sheet.userId)) return res.status(403).json({ error: "Forbidden" });
    }
    const entries = await db.select().from(timesheetEntriesTable).where(eq(timesheetEntriesTable.timesheetId, id));
    const [user] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, sheet.userId));
    res.json({ ...sheet, entries, user: user ?? null });
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
    if (sheet.status !== "draft" && sheet.status !== "rejected") return res.status(400).json({ error: "Cannot edit a submitted or approved timesheet" });

    const [existing] = await db.select().from(timesheetEntriesTable)
      .where(and(eq(timesheetEntriesTable.timesheetId, timesheetId), eq(timesheetEntriesTable.date, date)));

    let entry;
    if (existing) {
      [entry] = await db.update(timesheetEntriesTable).set({ minutes: minutes ?? 0, notes }).where(eq(timesheetEntriesTable.id, existing.id)).returning();
    } else {
      [entry] = await db.insert(timesheetEntriesTable).values({ timesheetId, userId, date, minutes: minutes ?? 0, notes }).returning();
    }

    // Recalculate total
    const allEntries = await db.select().from(timesheetEntriesTable).where(eq(timesheetEntriesTable.timesheetId, timesheetId));
    const totalMinutes = allEntries.reduce((sum, e) => sum + (e.minutes ?? 0), 0);
    await db.update(timesheetsTable).set({ totalMinutes, updatedAt: new Date() }).where(eq(timesheetsTable.id, timesheetId));

    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: "Failed to save entry" });
  }
});

// POST /timesheets/:id/submit
router.post("/timesheets/:id/submit", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const id = parseInt(req.params.id);
    const [sheet] = await db.select().from(timesheetsTable).where(eq(timesheetsTable.id, id));
    if (!sheet || sheet.userId !== userId) return res.status(403).json({ error: "Forbidden" });
    if (sheet.status !== "draft" && sheet.status !== "rejected") return res.status(400).json({ error: "Already submitted" });
    const [updated] = await db.update(timesheetsTable).set({ status: "submitted", submittedAt: new Date(), updatedAt: new Date() }).where(eq(timesheetsTable.id, id)).returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to submit" });
  }
});

// POST /timesheets/:id/approve
router.post("/timesheets/:id/approve", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id: approverId, role } = req.user!;
    if (role === "employee") return res.status(403).json({ error: "Forbidden" });
    const id = parseInt(req.params.id);
    const [updated] = await db.update(timesheetsTable)
      .set({ status: "approved", approvedBy: approverId, approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(timesheetsTable.id, id)).returning();
    res.json(updated);
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
    const [updated] = await db.update(timesheetsTable)
      .set({ status: "rejected", rejectedBy: rejectorId, rejectedAt: new Date(), notes, updatedAt: new Date() })
      .where(eq(timesheetsTable.id, id)).returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to reject" });
  }
});

export default router;
