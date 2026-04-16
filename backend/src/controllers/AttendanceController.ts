import { Op } from "sequelize";
import { AttendanceLog, AttendanceLocationPing, User, Site } from "../models/index.js";

export default class AttendanceController {
  static async getTodayStatus(userId: number) {
    const today = new Date().toISOString().split("T")[0];
    const log = await AttendanceLog.findOne({
      where: { userId, date: today },
      order: [["clockIn", "DESC"]],
    });
    return log ?? null;
  }

  static async clockIn(userId: number, data: { lat?: number; lng?: number; faceImage?: string; photoTime?: string }) {
    const { lat, lng, faceImage, photoTime } = data;
    const today = new Date().toISOString().split("T")[0];
    const existing = await AttendanceLog.findOne({
      where: { userId, date: today },
      order: [["clockIn", "DESC"]],
    });
    if (existing && existing.clockIn && !existing.clockOut) {
      return { error: "Already clocked in", status: 400 };
    }
    const emp = await User.findOne({ where: { id: userId }, attributes: ["siteId"] });
    const log = await AttendanceLog.create({
      userId,
      date: today,
      siteId: emp?.siteId ?? null,
      clockIn: new Date(),
      clockInLat: lat != null ? String(lat) : null,
      clockInLng: lng != null ? String(lng) : null,
      faceImageIn: faceImage ?? null,
      clockInPhotoTime: photoTime ? new Date(photoTime) : null,
    });
    return { data: log };
  }

  static async clockOut(userId: number, data: { notes?: string; lat?: number; lng?: number; faceImage?: string; photoTime?: string }) {
    const { notes, lat, lng, faceImage, photoTime } = data;
    const today = new Date().toISOString().split("T")[0];
    const existing = await AttendanceLog.findOne({
      where: { userId, date: today },
      order: [["clockIn", "DESC"]],
    });
    if (!existing || !existing.clockIn || existing.clockOut) {
      return { error: "Not currently clocked in", status: 400 };
    }
    const clockOut = new Date();
    const durationMinutes = Math.round((clockOut.getTime() - new Date(existing.clockIn!).getTime()) / 60000);
    const [, updatedRows] = await AttendanceLog.update({
      clockOut,
      durationMinutes,
      notes: notes ?? existing.notes,
      clockOutLat: lat != null ? String(lat) : null,
      clockOutLng: lng != null ? String(lng) : null,
      faceImageOut: faceImage ?? null,
      clockOutPhotoTime: photoTime ? new Date(photoTime) : null,
    }, { where: { id: existing.id }, returning: true });
    return { data: updatedRows[0] };
  }

  static async listLogs(userId: number, role: string, filters: { startDate?: string; endDate?: string; userId?: string; siteId?: string; department?: string }) {
    let rows = await AttendanceLog.findAll({ order: [["date", "DESC"]] });
    let rowsJson = rows.map(r => r.toJSON() as any);

    if (role === "employee") {
      rowsJson = rowsJson.filter((r: any) => r.userId === userId);
    } else if (role === "manager") {
      const subs = await User.findAll({ where: { managerId: userId }, attributes: ["id"] });
      const allowedIds = new Set([userId, ...subs.map(s => s.id)]);
      rowsJson = rowsJson.filter((r: any) => allowedIds.has(r.userId));
    }

    if (filters.userId && (role === "admin" || role === "super_admin" || role === "manager")) {
      const fid = parseInt(filters.userId);
      rowsJson = rowsJson.filter((r: any) => r.userId === fid);
    }
    if (filters.startDate) rowsJson = rowsJson.filter((r: any) => r.date >= filters.startDate!);
    if (filters.endDate) rowsJson = rowsJson.filter((r: any) => r.date <= filters.endDate!);

    // Site filter (uses siteId stamped on the attendance log at clock-in time)
    if (filters.siteId) {
      const sid = parseInt(filters.siteId);
      rowsJson = rowsJson.filter((r: any) => r.siteId === sid);
    }

    // Department filter — needs a join through users
    if (filters.department) {
      const deptUsers = await User.findAll({ where: { department: filters.department }, attributes: ["id"] });
      const deptIds = new Set(deptUsers.map(u => u.id));
      rowsJson = rowsJson.filter((r: any) => deptIds.has(r.userId));
    }

    const userIds = [...new Set(rowsJson.map((r: any) => r.userId))];
    const users = userIds.length > 0
      ? await User.findAll({
          where: { id: { [Op.in]: userIds } },
          attributes: ["id", "name", "email", "department", "profilePhoto"],
        })
      : [];
    const userMap = Object.fromEntries(users.map(u => [u.id, u.toJSON()]));

    const siteIds = [...new Set(rowsJson.map((r: any) => r.siteId).filter(Boolean))] as number[];
    const sites = siteIds.length > 0
      ? await Site.findAll({ where: { id: { [Op.in]: siteIds } } })
      : [];
    const siteMap = Object.fromEntries(sites.map(s => [s.id, s.toJSON()]));

    return rowsJson.map((r: any) => ({ ...r, user: userMap[r.userId] ?? null, site: r.siteId ? (siteMap[r.siteId] ?? null) : null }));
  }

  static async locationPing(userId: number, data: { lat: number; lng: number; recordedAt?: string }) {
    const { lat, lng, recordedAt } = data;
    const pingTime = recordedAt ? new Date(recordedAt) : new Date();
    const pingDate = pingTime.toISOString().split("T")[0];

    const active = await AttendanceLog.findOne({
      where: { userId, date: pingDate },
      order: [["clockIn", "DESC"]],
    });

    if (!active || !active.clockIn) {
      return { error: "No clock-in found for this date", status: 400 };
    }

    const ping = await AttendanceLocationPing.create({
      attendanceLogId: active.id,
      userId,
      lat: String(lat),
      lng: String(lng),
      recordedAt: pingTime,
    });
    return { data: ping };
  }

  static async batchLocationPing(userId: number, pings: Array<{ lat: number; lng: number; recordedAt: string }>) {
    const results: any[] = [];
    for (const p of pings) {
      const pingTime = new Date(p.recordedAt);
      const pingDate = pingTime.toISOString().split("T")[0];
      const active = await AttendanceLog.findOne({
        where: { userId, date: pingDate },
        order: [["clockIn", "DESC"]],
      });
      if (!active?.clockIn) continue;
      const inserted = await AttendanceLocationPing.create({
        attendanceLogId: active.id,
        userId,
        lat: String(p.lat),
        lng: String(p.lng),
        recordedAt: pingTime,
      });
      results.push(inserted);
    }
    return { saved: results.length };
  }

  static async faceReview(logId: number, reviewerId: number, status: string) {
    const [count, rows] = await AttendanceLog.update({
      faceReviewStatus: status,
      faceReviewedBy: reviewerId,
      faceReviewedAt: new Date(),
    }, { where: { id: logId }, returning: true });
    if (count === 0) return null;
    return rows[0];
  }

  static async getPings(logId: number, userId: number, role: string) {
    const log = await AttendanceLog.findByPk(logId);
    if (!log) return { error: "Not found", status: 404 };
    if (role === "employee" && log.userId !== userId) return { error: "Forbidden", status: 403 };
    const pings = await AttendanceLocationPing.findAll({
      where: { attendanceLogId: logId },
      order: [["recordedAt", "ASC"]],
    });
    return { data: pings };
  }
}
