import { Router } from "express";
import { db, attendanceLogsTable, attendanceLocationPingsTable, usersTable } from "../db/index.js";
import { eq, and, desc, inArray } from "drizzle-orm";
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
    const { lat, lng, faceImage, photoTime } = req.body;
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
      clockInLat: lat != null ? String(lat) : null,
      clockInLng: lng != null ? String(lng) : null,
      faceImageIn: faceImage ?? null,
      clockInPhotoTime: photoTime ? new Date(photoTime) : null,
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
    const { notes, lat, lng, faceImage, photoTime } = req.body;
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
      .set({
        clockOut,
        durationMinutes,
        notes: notes ?? existing.notes,
        clockOutLat: lat != null ? String(lat) : null,
        clockOutLng: lng != null ? String(lng) : null,
        faceImageOut: faceImage ?? null,
        clockOutPhotoTime: photoTime ? new Date(photoTime) : null,
      })
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

// POST /attendance/location-ping — periodic location update while clocked in
// Accepts optional `recordedAt` ISO string so offline-queued pings retain their original timestamp
router.post("/attendance/location-ping", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { lat, lng, recordedAt } = req.body;
    if (lat == null || lng == null) return res.status(400).json({ error: "lat and lng are required" });

    // Resolve which attendance log this ping belongs to
    // If recordedAt is provided use its date, otherwise use today
    const pingTime = recordedAt ? new Date(recordedAt) : new Date();
    const pingDate = pingTime.toISOString().split("T")[0];

    const [active] = await db.select().from(attendanceLogsTable)
      .where(and(eq(attendanceLogsTable.userId, userId), eq(attendanceLogsTable.date, pingDate)))
      .orderBy(desc(attendanceLogsTable.clockIn)).limit(1);

    // Allow pings for past sessions (clocked-out already) when flushing offline queue
    if (!active || !active.clockIn) {
      return res.status(400).json({ error: "No clock-in found for this date" });
    }

    const [ping] = await db.insert(attendanceLocationPingsTable).values({
      attendanceLogId: active.id,
      userId,
      lat: String(lat),
      lng: String(lng),
      recordedAt: pingTime,
    }).returning();
    res.json(ping);
  } catch (err) {
    res.status(500).json({ error: "Failed to save location ping" });
  }
});

// POST /attendance/location-ping/batch — flush multiple queued offline pings at once
router.post("/attendance/location-ping/batch", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { pings } = req.body as { pings: Array<{ lat: number; lng: number; recordedAt: string }> };
    if (!Array.isArray(pings) || pings.length === 0) return res.status(400).json({ error: "pings array required" });

    const results: any[] = [];
    for (const p of pings) {
      const pingTime = new Date(p.recordedAt);
      const pingDate = pingTime.toISOString().split("T")[0];
      const [active] = await db.select().from(attendanceLogsTable)
        .where(and(eq(attendanceLogsTable.userId, userId), eq(attendanceLogsTable.date, pingDate)))
        .orderBy(desc(attendanceLogsTable.clockIn)).limit(1);
      if (!active?.clockIn) continue;
      const [inserted] = await db.insert(attendanceLocationPingsTable).values({
        attendanceLogId: active.id,
        userId,
        lat: String(p.lat),
        lng: String(p.lng),
        recordedAt: pingTime,
      }).returning();
      results.push(inserted);
    }
    res.json({ saved: results.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to save batch pings" });
  }
});

// GET /attendance/:id/pings — get all location pings for a log entry
router.get("/attendance/:id/pings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: userId } = req.user!;
    const logId = parseInt(req.params.id);
    const [log] = await db.select().from(attendanceLogsTable).where(eq(attendanceLogsTable.id, logId)).limit(1);
    if (!log) return res.status(404).json({ error: "Not found" });
    if (role === "employee" && log.userId !== userId) return res.status(403).json({ error: "Forbidden" });
    const pings = await db.select().from(attendanceLocationPingsTable)
      .where(eq(attendanceLocationPingsTable.attendanceLogId, logId))
      .orderBy(attendanceLocationPingsTable.recordedAt);
    res.json(pings);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch pings" });
  }
});

export default router;
