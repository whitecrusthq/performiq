import { Op } from "sequelize";
import { Timesheet, TimesheetEntry, TimesheetApprover, User } from "../models/index.js";

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

export default class TimesheetController {
  static getWeekBounds = getWeekBounds;

  static async getApproversForSheet(timesheetId: number) {
    const rows = await TimesheetApprover.findAll({
      where: { timesheetId },
      order: [["orderIndex", "ASC"]],
    });
    if (rows.length === 0) return [];
    const approverUsers = await User.findAll({
      where: { id: { [Op.in]: rows.map(r => r.approverId) } },
      attributes: ["id", "name", "email", "department", "role"],
    });
    const userMap = Object.fromEntries(approverUsers.map(u => [u.id, u.toJSON()]));
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

  static async enrichSheet(sheet: any) {
    const sheetJson = sheet.toJSON ? sheet.toJSON() : sheet;
    const entries = await TimesheetEntry.findAll({ where: { timesheetId: sheetJson.id } });
    const approvers = await TimesheetController.getApproversForSheet(sheetJson.id);
    const currentApprover = approvers.find(a => a.status === "pending") ?? null;
    return { ...sheetJson, entries: entries.map(e => e.toJSON ? e.toJSON() : e), approvers, currentApproverId: currentApprover?.approverId ?? null };
  }

  static async listApprovers(selfId: number) {
    return User.findAll({
      where: {
        role: { [Op.in]: ["manager", "admin", "super_admin"] },
        id: { [Op.ne]: selfId },
      },
      attributes: ["id", "name", "email", "role", "department", "siteId"],
    });
  }

  static async listTimesheets(userId: number, role: string) {
    let rows = await Timesheet.findAll({ order: [["weekStart", "DESC"]] });

    if (role === "employee") {
      rows = rows.filter(r => r.userId === userId);
    } else if (role === "manager") {
      const subs = await User.findAll({ where: { managerId: userId }, attributes: ["id"] });
      const allowedIds = new Set([userId, ...subs.map(s => s.id)]);
      const approverRows = await TimesheetApprover.findAll({
        where: { approverId: userId },
        attributes: ["timesheetId"],
      });
      const approverSheetIds = new Set(approverRows.map(a => a.timesheetId));
      rows = rows.filter(r => allowedIds.has(r.userId) || approverSheetIds.has(r.id));
    }

    const userIds = [...new Set(rows.map(r => r.userId))];
    const users = userIds.length > 0
      ? await User.findAll({
          where: { id: { [Op.in]: userIds } },
          attributes: ["id", "name", "email", "department"],
        })
      : [];
    const userMap = Object.fromEntries(users.map(u => [u.id, u.toJSON()]));

    const enriched = await Promise.all(rows.map(async r => {
      const approvers = await TimesheetController.getApproversForSheet(r.id);
      const currentApprover = approvers.find(a => a.status === "pending") ?? null;
      return { ...(r.toJSON ? r.toJSON() : r), user: userMap[r.userId] ?? null, approvers, currentApproverId: currentApprover?.approverId ?? null };
    }));

    return enriched;
  }

  static async getCurrentTimesheet(userId: number) {
    const { weekStart, weekEnd } = getWeekBounds(new Date());
    let sheet = await Timesheet.findOne({ where: { userId, weekStart } });
    if (!sheet) {
      sheet = await Timesheet.create({ userId, weekStart, weekEnd, totalMinutes: 0 });
    }
    return TimesheetController.enrichSheet(sheet);
  }

  static async getWeekTimesheet(userId: number, dateParam: string | null) {
    const targetDate = dateParam ? new Date(dateParam + "T00:00:00") : new Date();

    const limitDate = new Date();
    limitDate.setMonth(limitDate.getMonth() - 3);
    limitDate.setDate(1);
    if (targetDate < limitDate) {
      return { error: "Cannot access timesheets older than 3 months", status: 400 };
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (targetDate > tomorrow) {
      return { error: "Cannot access future timesheets", status: 400 };
    }

    const { weekStart, weekEnd } = getWeekBounds(targetDate);
    let sheet = await Timesheet.findOne({ where: { userId, weekStart } });
    if (!sheet) {
      sheet = await Timesheet.create({ userId, weekStart, weekEnd, totalMinutes: 0 });
    }
    return { data: await TimesheetController.enrichSheet(sheet) };
  }

  static async getTimesheetById(timesheetId: number, userId: number, role: string) {
    const sheet = await Timesheet.findByPk(timesheetId);
    if (!sheet) return { error: "Not found", status: 404 };
    if (role === "employee" && sheet.userId !== userId) return { error: "Forbidden", status: 403 };
    if (role === "manager") {
      const subs = await User.findAll({ where: { managerId: userId }, attributes: ["id"] });
      const allowedIds = new Set([userId, ...subs.map(s => s.id)]);
      const approverRow = await TimesheetApprover.findOne({
        where: { timesheetId, approverId: userId },
      });
      if (!allowedIds.has(sheet.userId) && !approverRow) {
        return { error: "Forbidden", status: 403 };
      }
    }
    const user = await User.findOne({
      where: { id: sheet.userId },
      attributes: ["id", "name", "email"],
    });
    const enriched = await TimesheetController.enrichSheet(sheet);
    return { data: { ...enriched, user: user?.toJSON() ?? null } };
  }

  static async upsertEntry(timesheetId: number, userId: number, data: { date: string; minutes?: number; notes?: string }) {
    const { date, minutes, notes } = data;
    const sheet = await Timesheet.findByPk(timesheetId);
    if (!sheet || sheet.userId !== userId) return { error: "Forbidden", status: 403 };
    if (sheet.status !== "draft" && sheet.status !== "rejected") {
      return { error: "Cannot edit a submitted or approved timesheet", status: 400 };
    }

    const existing = await TimesheetEntry.findOne({
      where: { timesheetId, date },
    });

    let entry;
    if (existing) {
      const [, rows] = await TimesheetEntry.update(
        { minutes: minutes ?? 0, notes },
        { where: { id: existing.id }, returning: true }
      );
      entry = rows[0];
    } else {
      entry = await TimesheetEntry.create({ timesheetId, userId, date, minutes: minutes ?? 0, notes });
    }

    const allEntries = await TimesheetEntry.findAll({ where: { timesheetId } });
    const totalMinutes = allEntries.reduce((sum, e) => sum + (e.minutes ?? 0), 0);
    await Timesheet.update({ totalMinutes, updatedAt: new Date() }, { where: { id: timesheetId } });

    return { data: entry };
  }

  static async submitTimesheet(timesheetId: number, userId: number, approverIds?: number[]) {
    const sheet = await Timesheet.findByPk(timesheetId);
    if (!sheet || sheet.userId !== userId) return { error: "Forbidden", status: 403 };
    if (sheet.status !== "draft" && sheet.status !== "rejected") {
      return { error: "Already submitted", status: 400 };
    }

    await TimesheetApprover.destroy({ where: { timesheetId } });

    let orderedIds: number[] = Array.isArray(approverIds) && approverIds.length > 0
      ? approverIds.map(Number).filter(Boolean)
      : [];

    if (orderedIds.length === 0) {
      const emp = await User.findOne({ where: { id: userId }, attributes: ["managerId"] });
      if (emp?.managerId) orderedIds = [emp.managerId];
    }

    if (orderedIds.length > 0) {
      await TimesheetApprover.bulkCreate(
        orderedIds.map((aid, idx) => ({
          timesheetId,
          approverId: aid,
          orderIndex: idx,
          status: "pending",
        }))
      );
    }

    const [, rows] = await Timesheet.update(
      { status: "submitted", submittedAt: new Date(), approvedBy: null, approvedAt: null, updatedAt: new Date() },
      { where: { id: timesheetId }, returning: true }
    );

    return { data: await TimesheetController.enrichSheet(rows[0]) };
  }

  static async approveTimesheet(timesheetId: number, approverId: number, role: string) {
    if (role === "employee") return { error: "Forbidden", status: 403 };

    const sheet = await Timesheet.findByPk(timesheetId);
    if (!sheet) return { error: "Not found", status: 404 };
    if (sheet.status !== "submitted") return { error: "Timesheet is not submitted", status: 400 };

    const currentStep = await TimesheetApprover.findOne({
      where: { timesheetId, status: "pending" },
      order: [["orderIndex", "ASC"]],
    });

    const isAdmin = role === "admin" || role === "super_admin";
    const isCurrentApprover = currentStep && currentStep.approverId === approverId;

    if (!isAdmin && !isCurrentApprover) {
      return { error: "You are not the current approver for this timesheet", status: 403 };
    }

    if (currentStep) {
      await TimesheetApprover.update(
        { status: "approved", reviewedAt: new Date() },
        { where: { id: currentStep.id } }
      );
    }

    const nextStep = await TimesheetApprover.findOne({
      where: { timesheetId, status: "pending" },
      order: [["orderIndex", "ASC"]],
    });

    let updated;
    if (nextStep) {
      const [, rows] = await Timesheet.update(
        { updatedAt: new Date() },
        { where: { id: timesheetId }, returning: true }
      );
      updated = rows[0];
    } else {
      const [, rows] = await Timesheet.update(
        { status: "approved", approvedBy: approverId, approvedAt: new Date(), updatedAt: new Date() },
        { where: { id: timesheetId }, returning: true }
      );
      updated = rows[0];
    }

    return { data: await TimesheetController.enrichSheet(updated) };
  }

  static async rejectTimesheet(timesheetId: number, rejectorId: number, role: string, notes?: string) {
    if (role === "employee") return { error: "Forbidden", status: 403 };

    const sheet = await Timesheet.findByPk(timesheetId);
    if (!sheet) return { error: "Not found", status: 404 };

    const currentStep = await TimesheetApprover.findOne({
      where: { timesheetId, status: "pending" },
      order: [["orderIndex", "ASC"]],
    });

    const isAdmin = role === "admin" || role === "super_admin";
    const isCurrentApprover = currentStep && currentStep.approverId === rejectorId;

    if (!isAdmin && !isCurrentApprover) {
      return { error: "You are not the current approver for this timesheet", status: 403 };
    }

    if (currentStep) {
      await TimesheetApprover.update(
        { status: "rejected", note: notes || null, reviewedAt: new Date() },
        { where: { id: currentStep.id } }
      );
    }

    const [, rows] = await Timesheet.update(
      { status: "rejected", rejectedBy: rejectorId, rejectedAt: new Date(), notes, updatedAt: new Date() },
      { where: { id: timesheetId }, returning: true }
    );

    return { data: await TimesheetController.enrichSheet(rows[0]) };
  }
}
