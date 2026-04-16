import { User, Appraisal, Cycle, Criterion, AppraisalScore, AttendanceLog, Timesheet } from "../models/index.js";
import { Op } from "sequelize";

const RATING_BANDS = [
  { label: "Outstanding (≥4.5)", min: 4.5, max: 99 },
  { label: "Exceeds Expectations (3.5–4.4)", min: 3.5, max: 4.49 },
  { label: "Meets Expectations (2.5–3.4)", min: 2.5, max: 3.49 },
  { label: "Needs Improvement (1.5–2.4)", min: 1.5, max: 2.49 },
  { label: "Unsatisfactory (<1.5)", min: 0, max: 1.49 },
];

export default class ReportController {
  static async getReports(deptFilter?: string) {
    const allUsers = await User.findAll();
    const allUsersPlain = allUsers.map((u: any) => u.get({ plain: true }));
    const departments = Array.from(
      new Set(allUsersPlain.map((u: any) => u.department || "Unassigned"))
    ).sort();

    const users = deptFilter
      ? allUsersPlain.filter((u: any) => (u.department || "Unassigned") === deptFilter)
      : allUsersPlain;

    const userIds = new Set(users.map((u: any) => u.id));

    const roleBreakdown = users.reduce<Record<string, number>>((acc, u: any) => {
      acc[u.role] = (acc[u.role] || 0) + 1;
      return acc;
    }, {});
    const deptBreakdown = allUsersPlain.reduce<Record<string, number>>((acc, u: any) => {
      const dept = u.department || "Unassigned";
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {});

    const allAppraisalsRaw = await Appraisal.findAll({
      attributes: ["id", "status", "cycleId", "employeeId", "overallScore"],
    });
    const allAppraisals = allAppraisalsRaw.map((a: any) => a.get({ plain: true }));

    const appraisals = deptFilter
      ? allAppraisals.filter((a: any) => userIds.has(a.employeeId))
      : allAppraisals;

    const statusBreakdown = appraisals.reduce<Record<string, number>>((acc, a: any) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {});

    const total = appraisals.length;
    const completed = appraisals.filter((a: any) => a.status === "completed").length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const scored = appraisals.filter((a: any) => a.overallScore !== null && a.overallScore !== undefined);
    const avgOverallScore = scored.length > 0
      ? Number((scored.reduce((s: number, a: any) => s + Number(a.overallScore), 0) / scored.length).toFixed(2))
      : null;

    const empMap = new Map(allUsersPlain.map((u: any) => [u.id, u]));
    const deptScores: Record<string, number[]> = {};
    for (const a of scored) {
      const dept = empMap.get(a.employeeId)?.department || "Unassigned";
      if (!deptScores[dept]) deptScores[dept] = [];
      deptScores[dept].push(Number(a.overallScore));
    }
    const avgScoreByDept = Object.entries(deptScores).map(([dept, scores]) => ({
      department: dept,
      avgScore: Number((scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(2)),
      count: scores.length,
    })).sort((a, b) => b.avgScore - a.avgScore);

    const cyclesRaw = await Cycle.findAll();
    const cycles = cyclesRaw.map((c: any) => c.get({ plain: true }));
    const cycleStats = cycles.map((c: any) => {
      const cycleAppraisals = appraisals.filter((a: any) => a.cycleId === c.id);
      const cycleCompleted = cycleAppraisals.filter((a: any) => a.status === "completed").length;
      const cycleScored = cycleAppraisals.filter((a: any) => a.overallScore !== null);
      const cycleAvg = cycleScored.length > 0
        ? Number((cycleScored.reduce((s: number, a: any) => s + Number(a.overallScore), 0) / cycleScored.length).toFixed(2))
        : null;
      return {
        id: c.id, name: c.name, status: c.status, startDate: c.startDate, endDate: c.endDate,
        total: cycleAppraisals.length, completed: cycleCompleted,
        completionRate: cycleAppraisals.length > 0 ? Math.round((cycleCompleted / cycleAppraisals.length) * 100) : 0,
        avgScore: cycleAvg,
      };
    }).filter((c: any) => !deptFilter || c.total > 0);

    const appraisalIds = appraisals.map((a: any) => a.id);
    const allScoreRowsRaw = appraisalIds.length > 0
      ? await AppraisalScore.findAll({ where: { appraisalId: { [Op.in]: appraisalIds } } })
      : [];
    const allScoreRows = allScoreRowsRaw.map((s: any) => s.get({ plain: true }));
    const allCriteriaRaw = await Criterion.findAll();
    const allCriteria = allCriteriaRaw.map((c: any) => c.get({ plain: true }));
    const criteriaStats = allCriteria.map((c: any) => {
      const cScores = allScoreRows.filter((s: any) => s.criterionId === c.id);
      const selfScores = cScores.filter((s: any) => s.selfScore !== null).map((s: any) => Number(s.selfScore));
      const managerScores = cScores.filter((s: any) => s.managerScore !== null).map((s: any) => Number(s.managerScore));
      return {
        id: c.id, name: c.name, category: c.category,
        avgSelfScore: selfScores.length > 0 ? Number((selfScores.reduce((a: number, b: number) => a + b, 0) / selfScores.length).toFixed(2)) : null,
        avgManagerScore: managerScores.length > 0 ? Number((managerScores.reduce((a: number, b: number) => a + b, 0) / managerScores.length).toFixed(2)) : null,
        responseCount: cScores.length,
      };
    });

    const ratingDistribution = RATING_BANDS.map(band => ({
      label: band.label,
      count: scored.filter((a: any) => {
        const v = Number(a.overallScore);
        return v >= band.min && v <= band.max;
      }).length,
    }));

    let employeeList: any[] = [];
    if (deptFilter) {
      employeeList = users.map((u: any) => {
        const empAppraisals = appraisals.filter((a: any) => a.employeeId === u.id);
        const empCompleted = empAppraisals.filter((a: any) => a.status === "completed").length;
        const empScored = empAppraisals.filter((a: any) => a.overallScore !== null);
        const empAvg = empScored.length > 0
          ? Number((empScored.reduce((s: number, a: any) => s + Number(a.overallScore), 0) / empScored.length).toFixed(2))
          : null;
        return {
          id: u.id, name: u.name, jobTitle: u.jobTitle, role: u.role,
          totalAppraisals: empAppraisals.length, completed: empCompleted,
          completionRate: empAppraisals.length > 0 ? Math.round((empCompleted / empAppraisals.length) * 100) : 0,
          avgScore: empAvg,
        };
      }).sort((a: any, b: any) => (b.avgScore ?? -1) - (a.avgScore ?? -1));
    }

    return {
      departments, selectedDepartment: deptFilter ?? null,
      workforce: { total: users.length, roleBreakdown, deptBreakdown },
      appraisals: { total, completed, completionRate, avgOverallScore, statusBreakdown },
      avgScoreByDept, cycleStats, criteriaStats, ratingDistribution, employeeList,
    };
  }

  static async getAttendanceSummary(filters: { from?: string; to?: string; userId?: string }) {
    const allUsers = await User.findAll({ attributes: ["id", "name", "email", "department"] });
    const userMap = new Map<number, any>(allUsers.map((u: any) => [u.id, u.get({ plain: true })]));

    let logs = await AttendanceLog.findAll();
    let logsPlain = logs.map((l: any) => l.get({ plain: true }));
    if (filters.from) logsPlain = logsPlain.filter((l: any) => l.date >= filters.from!);
    if (filters.to) logsPlain = logsPlain.filter((l: any) => l.date <= filters.to!);
    if (filters.userId) logsPlain = logsPlain.filter((l: any) => l.userId === Number(filters.userId));

    const byUser = new Map<number, { daysPresent: number; totalMinutes: number }>();
    for (const log of logsPlain) {
      const existing = byUser.get(log.userId) ?? { daysPresent: 0, totalMinutes: 0 };
      byUser.set(log.userId, {
        daysPresent: existing.daysPresent + 1,
        totalMinutes: existing.totalMinutes + (log.durationMinutes ?? 0),
      });
    }

    const rows = Array.from(byUser.entries()).map(([uid, stats]) => {
      const user = userMap.get(uid);
      const avgMins = stats.daysPresent > 0 ? Math.round(stats.totalMinutes / stats.daysPresent) : 0;
      return {
        userId: uid,
        name: user?.name ?? "Unknown",
        email: user?.email ?? "",
        department: user?.department ?? "Unassigned",
        daysPresent: stats.daysPresent,
        totalMinutes: stats.totalMinutes,
        totalHours: Number((stats.totalMinutes / 60).toFixed(1)),
        avgMinutesPerDay: avgMins,
        avgHoursPerDay: Number((avgMins / 60).toFixed(1)),
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    const totalMinutes = rows.reduce((s, r) => s + r.totalMinutes, 0);
    const totalDays = rows.reduce((s, r) => s + r.daysPresent, 0);

    return {
      summary: {
        totalRecords: logsPlain.length,
        uniqueEmployees: rows.length,
        totalDays,
        totalMinutes,
        totalHours: Number((totalMinutes / 60).toFixed(1)),
        avgHoursPerDay: totalDays > 0 ? Number((totalMinutes / 60 / totalDays).toFixed(1)) : 0,
      },
      rows,
    };
  }

  static async getTimesheetsSummary(filters: { from?: string; to?: string; status?: string; userId?: string }) {
    const allUsers = await User.findAll({ attributes: ["id", "name", "email", "department"] });
    const userMap = new Map<number, any>(allUsers.map((u: any) => [u.id, u.get({ plain: true })]));

    let sheets = await Timesheet.findAll();
    let sheetsPlain = sheets.map((s: any) => s.get({ plain: true }));
    if (filters.from) sheetsPlain = sheetsPlain.filter((s: any) => s.weekStart >= filters.from!);
    if (filters.to) sheetsPlain = sheetsPlain.filter((s: any) => s.weekStart <= filters.to!);
    if (filters.status) sheetsPlain = sheetsPlain.filter((s: any) => s.status === filters.status);
    if (filters.userId) sheetsPlain = sheetsPlain.filter((s: any) => s.userId === Number(filters.userId));

    const rows = sheetsPlain.map((s: any) => {
      const user = userMap.get(s.userId);
      return {
        id: s.id, userId: s.userId,
        name: user?.name ?? "Unknown",
        email: user?.email ?? "",
        department: user?.department ?? "Unassigned",
        weekStart: s.weekStart, weekEnd: s.weekEnd,
        totalMinutes: s.totalMinutes,
        totalHours: Number((s.totalMinutes / 60).toFixed(1)),
        status: s.status,
        submittedAt: s.submittedAt,
        approvedAt: s.approvedAt,
      };
    }).sort((a: any, b: any) => b.weekStart.localeCompare(a.weekStart) || a.name.localeCompare(b.name));

    const totalMinutes = rows.reduce((s: number, r: any) => s + r.totalMinutes, 0);
    const statusCounts = rows.reduce<Record<string, number>>((acc, r: any) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      summary: {
        total: rows.length,
        approved: statusCounts["approved"] ?? 0,
        submitted: statusCounts["submitted"] ?? 0,
        rejected: statusCounts["rejected"] ?? 0,
        draft: statusCounts["draft"] ?? 0,
        totalMinutes,
        totalHours: Number((totalMinutes / 60).toFixed(1)),
      },
      rows,
    };
  }
}
