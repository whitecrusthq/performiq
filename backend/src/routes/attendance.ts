import { Router } from "express";
import { db, attendanceLogsTable, usersTable } from "../db/index.js";
import { eq, and, desc, gte, lte, inArray } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";

const router = Router();

// GET /attendance/today — current user's status today
router.get("/attendance/today", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const today = new Date().toISOString().split("T")[0];
    const [log] = await db.select().from(attendanceLogsTable)
      .where(and(eq(attendanceLogsTable.userId, userId), eq(attendanceLogsTable.date, today)))
      .orderBy(desc(attendanceLogsTable.clockIn))
      .limit(1);
    res.json(log ?? null);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch today status" });
  }
});

// POST /attendance/clock-in
router.post("/attendance/clock-in", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const today = new Date().toISOString().split("T")[0];
    // Check not already clocked in
    const [existing] = await db.select().from(attendanceLogsTable)
      .where(and(eq(attendanceLogsTable.userId, userId), eq(attendanceLogsTable.date, today)))
      .orderBy(desc(attendanceLogsTable.clockIn)).limit(1);
    if (existing && existing.clockIn && !existing.clockOut) {
      return res.status(400).json({ error: "Already clocked in" });
    }
    const [log] = await db.insert(attendanceLogsTable).values({
      userId,
      date: today,
      clockIn: new Date(),
    }).returning();
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: "Failed to clock in" });
  }
});

// POST /attendance/clock-out
router.post("/attendance/clock-out", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { notes } = req.body;
    const today = new Date().toISOString().split("T")[0];
    const [existing] = await db.select().from(attendanceLogsTable)
      .where(and(eq(attendanceLogsTable.userId, userId), eq(attendanceLogsTable.date, today)))
      .orderBy(desc(attendanceLogsTable.clockIn)).limit(1);
    if (!existing || !existing.clockIn || existing.clockOut) {
      return res.status(400).json({ error: "Not currently clocked in" });
    }
    const clockOut = new Date();
    const durationMinutes = Math.round((clockOut.getTime() - new Date(existing.clockIn).getTime()) / 60000);
    const [updated] = await db.update(attendanceLogsTable)
      .set({ clockOut, durationMinutes, notes: notes ?? existing.notes })
      .where(eq(attendanceLogsTable.id, existing.id))
      .returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to clock out" });
  }
});

// GET /attendance — list logs with optional filters
router.get("/attendance", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: userId } = req.user!;
    const { startDate, endDate, userId: filterUserId } = req.query as Record<string, string>;

    let rows = await db.select().from(attendanceLogsTable).orderBy(desc(attendanceLogsTable.date));

    if (role === "employee") {
      rows = rows.filter(r => r.userId === userId);
    } else if (role === "manager") {
      const subs = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.managerId, userId));
      const allowedIds = new Set([userId, ...subs.map(s => s.id)]);
      rows = rows.filter(r => allowedIds.has(r.userId));
    }

    if (filterUserId && (role === "admin" || role === "super_admin" || role === "manager")) {
      const fid = parseInt(filterUserId);
      rows = rows.filter(r => r.userId === fid);
    }
    if (startDate) rows = rows.filter(r => r.date >= startDate);
    if (endDate) rows = rows.filter(r => r.date <= endDate);

    const userIds = [...new Set(rows.map(r => r.userId))];
    const users = userIds.length > 0
      ? await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, department: usersTable.department })
          .from(usersTable).where(inArray(usersTable.id, userIds))
      : [];
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    res.json(rows.map(r => ({ ...r, user: userMap[r.userId] ?? null })));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch attendance logs" });
  }
});

export default router;
