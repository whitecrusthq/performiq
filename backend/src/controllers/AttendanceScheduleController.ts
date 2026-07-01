import { Op } from "sequelize";
import { AttendanceLog, AttendanceLocationPing, AttendanceSetting, Department } from "../models/index.js";
import {
  DEFAULT_TZ,
  DEFAULT_DAY_SWEEPS,
  DEFAULT_NIGHT_SWEEPS,
  parseHHMM,
} from "../lib/attendance-time.js";

function sanitizeSweeps(list: any, fallback: string[]): string[] {
  if (!Array.isArray(list)) return fallback;
  const cleaned = list
    .map((s: any) => (typeof s === "string" ? s.trim() : ""))
    .filter((s: string) => parseHHMM(s) !== null);
  const uniq = Array.from(new Set(cleaned));
  uniq.sort();
  return uniq;
}

export default class AttendanceScheduleController {
  static async getSettings() {
    let s = await AttendanceSetting.findByPk(1);
    if (!s) {
      s = await AttendanceSetting.create({
        id: 1,
        daySweepTimes: DEFAULT_DAY_SWEEPS,
        nightSweepTimes: DEFAULT_NIGHT_SWEEPS,
        graceMinutes: 0,
        timezone: DEFAULT_TZ,
      });
    }
    return s;
  }

  static async getTimezone(): Promise<string> {
    const s = await this.getSettings();
    return (s.timezone && s.timezone.trim()) || DEFAULT_TZ;
  }

  static async getSettingsPayload() {
    const s = await this.getSettings();
    const departments = await Department.findAll({ order: [["name", "ASC"]] });
    return {
      settings: {
        daySweepTimes: s.daySweepTimes ?? [],
        nightSweepTimes: s.nightSweepTimes ?? [],
        graceMinutes: s.graceMinutes ?? 0,
        timezone: s.timezone ?? DEFAULT_TZ,
      },
      departments: departments.map((d) => ({
        id: d.id,
        name: d.name,
        shiftType: d.shiftType ?? null,
        clockOutSlot: d.clockOutSlot ?? null,
      })),
    };
  }

  static async updateSettings(data: any) {
    await this.getSettings();
    const updates: any = {};
    if (data.daySweepTimes !== undefined) {
      updates.daySweepTimes = sanitizeSweeps(data.daySweepTimes, DEFAULT_DAY_SWEEPS);
    }
    if (data.nightSweepTimes !== undefined) {
      updates.nightSweepTimes = sanitizeSweeps(data.nightSweepTimes, DEFAULT_NIGHT_SWEEPS);
    }
    if (data.graceMinutes !== undefined) {
      const g = Number(data.graceMinutes);
      updates.graceMinutes = Number.isFinite(g) && g >= 0 && g <= 240 ? Math.round(g) : 0;
    }
    if (data.timezone !== undefined && typeof data.timezone === "string" && data.timezone.trim()) {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: data.timezone.trim() });
        updates.timezone = data.timezone.trim();
      } catch {
        /* ignore invalid timezone */
      }
    }
    if (Object.keys(updates).length > 0) {
      await AttendanceSetting.update(updates, { where: { id: 1 } });
    }
    return this.getSettingsPayload();
  }

  /**
   * Auto-close every open attendance session whose stamped expectedClockOut
   * (plus grace) is now in the past. Idempotent: the UPDATE is guarded on
   * clock_out IS NULL so concurrent sweeps can't double-close a row. The
   * latest location ping is attached as the clock-out location so auditors can
   * see the last confirmed position (and how stale it is).
   */
  static async runSweep(): Promise<number> {
    const now = new Date();
    const s = await this.getSettings();
    const graceMs = (s.graceMinutes ?? 0) * 60000;
    const openLogs = await AttendanceLog.findAll({
      where: {
        clockOut: null,
        clockIn: { [Op.ne]: null },
        expectedClockOut: { [Op.ne]: null },
      },
    });
    let closed = 0;
    for (const log of openLogs) {
      const expRaw = log.expectedClockOut;
      if (!expRaw) continue;
      const dueAt = new Date(expRaw).getTime() + graceMs;
      if (now.getTime() < dueAt) continue;
      const clockOutAt = new Date(dueAt);
      const lastPing = await AttendanceLocationPing.findOne({
        where: { attendanceLogId: log.id },
        order: [["recordedAt", "DESC"]],
      });
      const durationMinutes = log.clockIn
        ? Math.max(0, Math.round((clockOutAt.getTime() - new Date(log.clockIn).getTime()) / 60000))
        : null;
      const note = "Auto clocked out — no manual clock-out";
      const newNotes = log.notes ? `${log.notes}\n${note}` : note;
      const [count] = await AttendanceLog.update(
        {
          clockOut: clockOutAt,
          durationMinutes,
          clockOutSource: "auto",
          autoClockedOut: true,
          clockOutLat: lastPing ? lastPing.lat : null,
          clockOutLng: lastPing ? lastPing.lng : null,
          clockOutLocationTime: lastPing ? lastPing.recordedAt : null,
          notes: newNotes,
        },
        { where: { id: log.id, clockOut: null } }
      );
      if (count > 0) closed++;
    }
    return closed;
  }
}
