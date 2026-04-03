import { Router } from "express";
import { Op } from "sequelize";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import { AgentAttendance } from "../models/AgentAttendance.js";
import { AgentAttendancePing } from "../models/AgentAttendancePing.js";
import { Agent } from "../models/Agent.js";

const router = Router();

// ── GET /attendance/today — current agent's status today ─────────────────────
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
    const { lat, lng, faceImage, photoTime } = req.body;
    const today = new Date().toISOString().split("T")[0];

    const existing = await AgentAttendance.findOne({
      where: { agentId, date: today, clockIn: { [Op.ne]: null }, clockOut: null },
      order: [["clockIn", "DESC"]],
    });
    if (existing) {
      return res.status(400).json({ error: "Already clocked in" });
    }

    const log = await AgentAttendance.create({
      agentId,
      date: today,
      clockIn: new Date(),
      clockInLat: lat != null ? String(lat) : null,
      clockInLng: lng != null ? String(lng) : null,
      faceImageIn: faceImage ?? null,
      clockInPhotoTime: photoTime ? new Date(photoTime) : null,
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
    if (!existing) {
      return res.status(400).json({ error: "Not currently clocked in" });
    }

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

// ── GET /attendance — list logs with optional filters ─────────────────────────
router.get("/attendance", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: agentId } = req.agent!;
    const { startDate, endDate, agentId: filterAgentId } = req.query as Record<string, string>;

    const isManager = role === "admin" || role === "supervisor";

    const where: any = {};

    if (!isManager) {
      where.agentId = agentId;
    } else if (filterAgentId) {
      where.agentId = parseInt(filterAgentId);
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date[Op.gte] = startDate;
      if (endDate) where.date[Op.lte] = endDate;
    }

    const logs = await AgentAttendance.findAll({
      where,
      include: [
        {
          model: Agent,
          as: "agent",
          attributes: ["id", "name", "email", "avatar", "role"],
        },
      ],
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
    if (lat == null || lng == null) {
      return res.status(400).json({ error: "lat and lng are required" });
    }

    const pingTime = recordedAt ? new Date(recordedAt) : new Date();
    const pingDate = pingTime.toISOString().split("T")[0];

    const active = await AgentAttendance.findOne({
      where: { agentId, date: pingDate, clockIn: { [Op.ne]: null } },
      order: [["clockIn", "DESC"]],
    });

    if (!active) {
      return res.status(400).json({ error: "No clock-in found for this date" });
    }

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
    if (!Array.isArray(pings) || pings.length === 0) {
      return res.status(400).json({ error: "pings array required" });
    }

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
    if (role === "agent") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const logId = parseInt(req.params.id);
    const { status } = req.body as { status: "verified" | "flagged" | "pending" };

    if (!["verified", "flagged", "pending"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const log = await AgentAttendance.findByPk(logId);
    if (!log) return res.status(404).json({ error: "Log not found" });

    await log.update({
      faceReviewStatus: status,
      faceReviewedBy: reviewerId,
      faceReviewedAt: new Date(),
    });

    res.json(log);
  } catch (err) {
    console.error("face-review error:", err);
    res.status(500).json({ error: "Failed to update face review" });
  }
});

// ── GET /attendance/:id/pings ─────────────────────────────────────────────────
router.get("/attendance/:id/pings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: agentId } = req.agent!;
    const logId = parseInt(req.params.id);

    const log = await AgentAttendance.findByPk(logId);
    if (!log) return res.status(404).json({ error: "Not found" });

    if (role === "agent" && log.agentId !== agentId) {
      return res.status(403).json({ error: "Forbidden" });
    }

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

export default router;
