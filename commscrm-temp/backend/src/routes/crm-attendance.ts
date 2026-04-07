import { Router } from "express";
import { Op } from "sequelize";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import { AgentAttendance } from "../models/AgentAttendance.js";
import { AgentAttendancePing } from "../models/AgentAttendancePing.js";
import { AgentShift } from "../models/AgentShift.js";
import { Agent } from "../models/Agent.js";

const router = Router();

// ── Shift helper ──────────────────────────────────────────────────────────────
// Returns the clockInDiffMinutes: negative = early, positive = late, null = no shift
async function computeShiftDiff(agentId: number, clockInTime: Date): Promise<{
  shiftStartExpected: string | null;
  shiftGraceMinutes: number | null;
  clockInDiffMinutes: number | null;
}> {
  const dayOfWeek = clockInTime.getDay(); // 0=Sun, 6=Sat
  const shift = await AgentShift.findOne({
    where: { agentId, isActive: true },
  });
  if (!shift) return { shiftStartExpected: null, shiftGraceMinutes: null, clockInDiffMinutes: null };

  let days: number[] = [];
  try { days = JSON.parse(shift.daysOfWeek); } catch { /* ignore */ }
  if (!days.includes(dayOfWeek)) return { shiftStartExpected: null, shiftGraceMinutes: null, clockInDiffMinutes: null };

  const [shiftH, shiftM] = shift.startTime.split(":").map(Number);
  const shiftStartMs = shiftH * 60 + shiftM;
  const clockInH = clockInTime.getHours();
  const clockInM = clockInTime.getMinutes();
  const clockInMs = clockInH * 60 + clockInM;
  const diffMinutes = clockInMs - shiftStartMs;

  return {
    shiftStartExpected: shift.startTime,
    shiftGraceMinutes: shift.graceMinutes,
    clockInDiffMinutes: diffMinutes,
  };
}

// ── GET /attendance/today ─────────────────────────────────────────────────────
router.get("/attendance/today", requireAuth, async (req: AuthRequest, res) => {
  try {
    const agentId = req.agent!.id;
    const today = new Date().toISOString().split("T")[0];
    const log = await AgentAttendance.findOne({
      where: { agentId, date: today },
      order: [["clockIn", "DESC"]],
    });
    res.json(log ?? null);
  } catch (err) {
    console.error("attendance/today error:", err);
    res.status(500).json({ error: "Failed to fetch today status" });
  }
});

// ── POST /attendance/clock-in ─────────────────────────────────────────────────
router.post("/attendance/clock-in", requireAuth, async (req: AuthRequest, res) => {
  try {
    const agentId = req.agent!.id;
    const { lat, lng, faceImage, photoTime, deviceId, deviceType, deviceBrowser, deviceOs } = req.body;
    const today = new Date().toISOString().split("T")[0];

    const existing = await AgentAttendance.findOne({
      where: { agentId, date: today, clockIn: { [Op.ne]: null }, clockOut: null },
      order: [["clockIn", "DESC"]],
    });
    if (existing) return res.status(400).json({ error: "Already clocked in" });

    const clockInTime = new Date();
    const { shiftStartExpected, shiftGraceMinutes, clockInDiffMinutes } = await computeShiftDiff(agentId, clockInTime);

    const log = await AgentAttendance.create({
      agentId,
      date: today,
      clockIn: clockInTime,
      clockInLat: lat != null ? String(lat) : null,
      clockInLng: lng != null ? String(lng) : null,
      faceImageIn: faceImage ?? null,
      clockInPhotoTime: photoTime ? new Date(photoTime) : null,
      shiftStartExpected,
      shiftGraceMinutes,
      clockInDiffMinutes,
      deviceId: deviceId ?? null,
      deviceType: deviceType ?? null,
      deviceBrowser: deviceBrowser ?? null,
      deviceOs: deviceOs ?? null,
    });
    res.json(log);
  } catch (err) {
    console.error("attendance/clock-in error:", err);
    res.status(500).json({ error: "Failed to clock in" });
  }
});

// ── POST /attendance/clock-out ────────────────────────────────────────────────
router.post("/attendance/clock-out", requireAuth, async (req: AuthRequest, res) => {
  try {
    const agentId = req.agent!.id;
    const { notes, lat, lng, faceImage, photoTime } = req.body;
    const today = new Date().toISOString().split("T")[0];

    const existing = await AgentAttendance.findOne({
      where: { agentId, date: today, clockIn: { [Op.ne]: null }, clockOut: null },
      order: [["clockIn", "DESC"]],
    });
    if (!existing) return res.status(400).json({ error: "Not currently clocked in" });

    const clockOut = new Date();
    const durationMinutes = Math.round(
      (clockOut.getTime() - new Date(existing.clockIn!).getTime()) / 60000
    );

    await existing.update({
      clockOut,
      durationMinutes,
      notes: notes ?? existing.notes,
      clockOutLat: lat != null ? String(lat) : null,
      clockOutLng: lng != null ? String(lng) : null,
      faceImageOut: faceImage ?? null,
      clockOutPhotoTime: photoTime ? new Date(photoTime) : null,
    });

    res.json(existing);
  } catch (err) {
    console.error("attendance/clock-out error:", err);
    res.status(500).json({ error: "Failed to clock out" });
  }
});

// ── GET /attendance ───────────────────────────────────────────────────────────
router.get("/attendance", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: agentId } = req.agent!;
    const { startDate, endDate, agentId: filterAgentId } = req.query as Record<string, string>;

    const isManager = role === "admin" || role === "supervisor";
    const where: Record<string, unknown> = {};

    if (!isManager) {
      where.agentId = agentId;
    } else if (filterAgentId) {
      where.agentId = parseInt(filterAgentId);
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) (where.date as Record<string, unknown>)[Op.gte as symbol] = startDate;
      if (endDate) (where.date as Record<string, unknown>)[Op.lte as symbol] = endDate;
    }

    const logs = await AgentAttendance.findAll({
      where,
      include: [{ model: Agent, as: "agent", attributes: ["id", "name", "email", "avatar", "role"] }],
      order: [["date", "DESC"], ["clockIn", "DESC"]],
    });

    res.json(logs);
  } catch (err) {
    console.error("attendance list error:", err);
    res.status(500).json({ error: "Failed to fetch attendance logs" });
  }
});

// ── POST /attendance/location-ping ────────────────────────────────────────────
router.post("/attendance/location-ping", requireAuth, async (req: AuthRequest, res) => {
  try {
    const agentId = req.agent!.id;
    const { lat, lng, recordedAt } = req.body;
    if (lat == null || lng == null) return res.status(400).json({ error: "lat and lng are required" });

    const pingTime = recordedAt ? new Date(recordedAt) : new Date();
    const pingDate = pingTime.toISOString().split("T")[0];

    const active = await AgentAttendance.findOne({
      where: { agentId, date: pingDate, clockIn: { [Op.ne]: null } },
      order: [["clockIn", "DESC"]],
    });
    if (!active) return res.status(400).json({ error: "No clock-in found for this date" });

    const ping = await AgentAttendancePing.create({
      attendanceId: active.id,
      agentId,
      lat: String(lat),
      lng: String(lng),
      recordedAt: pingTime,
    });
    res.json(ping);
  } catch (err) {
    console.error("location-ping error:", err);
    res.status(500).json({ error: "Failed to save location ping" });
  }
});

// ── POST /attendance/location-ping/batch ──────────────────────────────────────
router.post("/attendance/location-ping/batch", requireAuth, async (req: AuthRequest, res) => {
  try {
    const agentId = req.agent!.id;
    const { pings } = req.body as { pings: Array<{ lat: number; lng: number; recordedAt: string }> };
    if (!Array.isArray(pings) || pings.length === 0) return res.status(400).json({ error: "pings array required" });

    let saved = 0;
    for (const p of pings) {
      const pingTime = new Date(p.recordedAt);
      const pingDate = pingTime.toISOString().split("T")[0];
      const active = await AgentAttendance.findOne({
        where: { agentId, date: pingDate, clockIn: { [Op.ne]: null } },
        order: [["clockIn", "DESC"]],
      });
      if (!active) continue;
      await AgentAttendancePing.create({
        attendanceId: active.id,
        agentId,
        lat: String(p.lat),
        lng: String(p.lng),
        recordedAt: pingTime,
      });
      saved++;
    }
    res.json({ saved });
  } catch (err) {
    console.error("location-ping/batch error:", err);
    res.status(500).json({ error: "Failed to save batch pings" });
  }
});

// ── PUT /attendance/:id/face-review ──────────────────────────────────────────
router.put("/attendance/:id/face-review", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: reviewerId } = req.agent!;
    if (role === "agent") return res.status(403).json({ error: "Forbidden" });

    const logId = parseInt(req.params.id);
    const { status } = req.body as { status: "verified" | "flagged" | "pending" };
    if (!["verified", "flagged", "pending"].includes(status)) return res.status(400).json({ error: "Invalid status" });

    const log = await AgentAttendance.findByPk(logId);
    if (!log) return res.status(404).json({ error: "Log not found" });

    await log.update({ faceReviewStatus: status, faceReviewedBy: reviewerId, faceReviewedAt: new Date() });
    res.json(log);
  } catch (err) {
    console.error("face-review error:", err);
    res.status(500).json({ error: "Failed to update face review" });
  }
});

// ── GET /attendance/monitor ───────────────────────────────────────────────────
router.get("/attendance/monitor", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role } = req.agent!;
    if (role === "agent") return res.status(403).json({ error: "Forbidden" });

    const today = new Date().toISOString().split("T")[0];
    const now = new Date();

    const activeLogs = await AgentAttendance.findAll({
      where: { date: today, clockIn: { [Op.ne]: null }, clockOut: null },
      include: [{ model: Agent, as: "agent", attributes: ["id", "name", "email", "avatar", "role", "lastActiveAt", "activeConversations", "resolvedToday"] }],
    });

    const completedLogs = await AgentAttendance.findAll({
      where: { date: today, clockIn: { [Op.ne]: null }, clockOut: { [Op.ne]: null } },
      include: [{ model: Agent, as: "agent", attributes: ["id", "name", "email", "avatar", "role", "lastActiveAt", "activeConversations", "resolvedToday"] }],
    });

    function toStatus(lastActiveAt: Date | null): "active" | "away" | "idle" | "offline" {
      if (!lastActiveAt) return "offline";
      const idleMins = (now.getTime() - new Date(lastActiveAt).getTime()) / 60000;
      if (idleMins < 5) return "active";
      if (idleMins < 15) return "away";
      if (idleMins < 60) return "idle";
      return "offline";
    }

    function shiftStatus(diff: number | null, grace: number | null) {
      if (diff === null) return null;
      const g = grace ?? 15;
      if (diff < -5) return { status: "early", label: `Early ${Math.abs(diff)}m` };
      if (diff <= g) return { status: "on-time", label: "On Time" };
      return { status: "late", label: `Late ${diff}m` };
    }

    const clockedIn = activeLogs.map((log: any) => {
      const agent = log.agent;
      const idleMins = agent?.lastActiveAt
        ? Math.round((now.getTime() - new Date(agent.lastActiveAt).getTime()) / 60000)
        : null;
      return {
        logId: log.id,
        agentId: log.agentId,
        name: agent?.name ?? "Unknown",
        email: agent?.email ?? "",
        avatar: agent?.avatar ?? null,
        role: agent?.role ?? "agent",
        clockIn: log.clockIn,
        lastActiveAt: agent?.lastActiveAt ?? null,
        idleMinutes: idleMins,
        activityStatus: toStatus(agent?.lastActiveAt ?? null),
        activeConversations: agent?.activeConversations ?? 0,
        resolvedToday: agent?.resolvedToday ?? 0,
        shiftDurationMinutes: log.clockIn
          ? Math.round((now.getTime() - new Date(log.clockIn).getTime()) / 60000)
          : 0,
        shiftBenchmark: shiftStatus(log.clockInDiffMinutes, log.shiftGraceMinutes),
        shiftStartExpected: log.shiftStartExpected,
      };
    });

    const clockedOut = completedLogs.map((log: any) => {
      const agent = log.agent;
      return {
        logId: log.id,
        agentId: log.agentId,
        name: agent?.name ?? "Unknown",
        email: agent?.email ?? "",
        avatar: agent?.avatar ?? null,
        role: agent?.role ?? "agent",
        clockIn: log.clockIn,
        clockOut: log.clockOut,
        durationMinutes: log.durationMinutes,
        resolvedToday: agent?.resolvedToday ?? 0,
        activityStatus: "clocked-out" as const,
        shiftBenchmark: shiftStatus(log.clockInDiffMinutes, log.shiftGraceMinutes),
        shiftStartExpected: log.shiftStartExpected,
      };
    });

    res.json({
      clockedIn,
      clockedOut,
      summary: {
        total: clockedIn.length + clockedOut.length,
        active: clockedIn.filter(a => a.activityStatus === "active").length,
        away: clockedIn.filter(a => a.activityStatus === "away").length,
        idle: clockedIn.filter(a => a.activityStatus === "idle").length,
        offline: clockedIn.filter(a => a.activityStatus === "offline").length,
        clockedOut: clockedOut.length,
      },
    });
  } catch (err) {
    console.error("attendance/monitor error:", err);
    res.status(500).json({ error: "Failed to fetch monitor data" });
  }
});

// ── GET /attendance/:id/pings ─────────────────────────────────────────────────
router.get("/attendance/:id/pings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: agentId } = req.agent!;
    const logId = parseInt(req.params.id);

    const log = await AgentAttendance.findByPk(logId);
    if (!log) return res.status(404).json({ error: "Not found" });
    if (role === "agent" && log.agentId !== agentId) return res.status(403).json({ error: "Forbidden" });

    const pings = await AgentAttendancePing.findAll({
      where: { attendanceId: logId },
      order: [["recordedAt", "ASC"]],
    });
    res.json(pings);
  } catch (err) {
    console.error("pings error:", err);
    res.status(500).json({ error: "Failed to fetch pings" });
  }
});

// ── SHIFT SCHEDULE CRUD ───────────────────────────────────────────────────────

// GET /attendance/shifts — list shifts (admin/supervisor see all, agent sees own)
router.get("/attendance/shifts", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: agentId } = req.agent!;
    const isManager = role === "admin" || role === "supervisor";

    const where: Record<string, unknown> = {};
    if (!isManager) where.agentId = agentId;

    const shifts = await AgentShift.findAll({
      where,
      include: [{ model: Agent, as: "agent", attributes: ["id", "name", "email", "role"] }],
      order: [["agentId", "ASC"], ["shiftName", "ASC"]],
    });
    res.json(shifts);
  } catch (err) {
    console.error("shifts list error:", err);
    res.status(500).json({ error: "Failed to fetch shifts" });
  }
});

// POST /attendance/shifts — create shift (admin/supervisor only)
router.post("/attendance/shifts", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role } = req.agent!;
    if (role === "agent") return res.status(403).json({ error: "Forbidden" });

    const { agentId, shiftName, startTime, endTime, daysOfWeek, graceMinutes } = req.body;
    if (!agentId || !shiftName || !startTime || !endTime) {
      return res.status(400).json({ error: "agentId, shiftName, startTime and endTime are required" });
    }

    const shift = await AgentShift.create({
      agentId,
      shiftName,
      startTime,
      endTime,
      daysOfWeek: JSON.stringify(daysOfWeek ?? [1, 2, 3, 4, 5]),
      graceMinutes: graceMinutes ?? 15,
      isActive: true,
    });

    const withAgent = await AgentShift.findByPk(shift.id, {
      include: [{ model: Agent, as: "agent", attributes: ["id", "name", "email", "role"] }],
    });
    res.status(201).json(withAgent);
  } catch (err) {
    console.error("shifts create error:", err);
    res.status(500).json({ error: "Failed to create shift" });
  }
});

// PUT /attendance/shifts/:id — update shift (admin/supervisor only)
router.put("/attendance/shifts/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role } = req.agent!;
    if (role === "agent") return res.status(403).json({ error: "Forbidden" });

    const shift = await AgentShift.findByPk(parseInt(req.params.id));
    if (!shift) return res.status(404).json({ error: "Shift not found" });

    const { shiftName, startTime, endTime, daysOfWeek, graceMinutes, isActive } = req.body;
    await shift.update({
      shiftName: shiftName ?? shift.shiftName,
      startTime: startTime ?? shift.startTime,
      endTime: endTime ?? shift.endTime,
      daysOfWeek: daysOfWeek !== undefined ? JSON.stringify(daysOfWeek) : shift.daysOfWeek,
      graceMinutes: graceMinutes ?? shift.graceMinutes,
      isActive: isActive !== undefined ? isActive : shift.isActive,
    });

    const withAgent = await AgentShift.findByPk(shift.id, {
      include: [{ model: Agent, as: "agent", attributes: ["id", "name", "email", "role"] }],
    });
    res.json(withAgent);
  } catch (err) {
    console.error("shifts update error:", err);
    res.status(500).json({ error: "Failed to update shift" });
  }
});

// DELETE /attendance/shifts/:id — delete shift (admin/supervisor only)
router.delete("/attendance/shifts/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role } = req.agent!;
    if (role === "agent") return res.status(403).json({ error: "Forbidden" });

    const shift = await AgentShift.findByPk(parseInt(req.params.id));
    if (!shift) return res.status(404).json({ error: "Shift not found" });

    await shift.destroy();
    res.json({ deleted: true });
  } catch (err) {
    console.error("shifts delete error:", err);
    res.status(500).json({ error: "Failed to delete shift" });
  }
});

export default router;
