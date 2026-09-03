import { Op } from "sequelize";
import { User, Cycle, Appraisal, Goal, LeavePolicy, LeaveAllocation, LeaveRequest, LeaveType } from "../models/index.js";
import LeaveController from "./LeaveController.js";
import { protectedWhere, getProtectedUserIds } from "../utils/protectedUsers.js";

const getCycleKey = (policy: any) => LeaveController.getCycleKey(policy);

async function getLeaveBalance(userId: number) {
  const policies = await LeavePolicy.findAll();
  const cycleKeys = [...new Set(policies.map((p: any) => getCycleKey(p)))];
  if (cycleKeys.length === 0) cycleKeys.push(new Date().getFullYear());

  // Single shared allocator: applies the policy's proration rules so a new
  // starter who opens the dashboard first doesn't get a full-year allocation.
  for (const p of policies) {
    await LeaveController.ensureAllocation(userId, (p as any).leaveType, getCycleKey(p));
  }

  const allAllocations: any[] = [];
  for (const ck of cycleKeys) {
    const rows = await LeaveAllocation.findAll({
      where: { employeeId: userId, cycleYear: ck },
    });
    allAllocations.push(...rows.map((r: any) => r.get({ plain: true })));
  }

  const seen = new Set<string>();
  const dedupedAllocations = allAllocations.filter(a => {
    if (seen.has(a.leaveType)) return false;
    seen.add(a.leaveType);
    return true;
  });

  const pendingCount = await LeaveRequest.count({
    where: { employeeId: userId, status: "pending" },
  });

  const leaveTypeRows = await LeaveType.findAll();
  const labelMap: Record<string, string> = {};
  for (const lt of leaveTypeRows as any[]) labelMap[lt.name] = lt.label;

  return {
    cycleYear: cycleKeys[0],
    pendingLeaveRequests: pendingCount,
    balances: dedupedAllocations.map(a => ({
      leaveType: a.leaveType,
      label: labelMap[a.leaveType] || a.leaveType,
      allocated: a.allocated,
      used: a.used,
      remaining: a.allocated - a.used,
    })),
  };
}

export default class DashboardController {
  static async getDashboard(userId: number, role: string) {
    if (role === "admin" || role === "super_admin") {
      // Protected accounts are excluded from everything below super admin.
      const hiddenIds = role === "super_admin" ? new Set<number>() : await getProtectedUserIds();
      const empCount = await User.count({ where: { role: "employee", ...protectedWhere(role) } });
      const mgrCount = await User.count({ where: { role: "manager", ...protectedWhere(role) } });
      const hiddenFilter = hiddenIds.size > 0 ? { [Op.notIn]: [...hiddenIds] } : null;
      const apprWhere = (status: string) => hiddenFilter ? { status, employeeId: hiddenFilter } : { status };
      const activeCount = await Cycle.count({ where: { status: "active" } });
      const pendingCount = await Appraisal.count({ where: apprWhere("pending") });
      const awaitingApprovalCount = await Appraisal.count({ where: apprWhere("pending_approval") });
      const completedCount = await Appraisal.count({ where: apprWhere("completed") });
      const myGoals = await Goal.count({ where: hiddenFilter ? { userId: hiddenFilter } : {} });
      const activeGoals = await Goal.count({ where: hiddenFilter ? { status: "in_progress", userId: hiddenFilter } : { status: "in_progress" } });

      const recentAppraisalsRaw = await Appraisal.findAll({ order: [["createdAt", "ASC"]] });
      const recentAppraisals = recentAppraisalsRaw.filter((a: any) => !hiddenIds.has(a.employeeId)).slice(0, 5);
      const enrichedAppraisals = await Promise.all(recentAppraisals.map(async (a: any) => {
        const emp = await User.findByPk(a.employeeId);
        const cyc = await Cycle.findByPk(a.cycleId);
        return { ...a.get({ plain: true }), employee: emp ? emp.get({ plain: true }) : null, cycle: cyc ? cyc.get({ plain: true }) : null, reviewer: null };
      }));

      const recentGoalsRaw = await Goal.findAll({ order: [["createdAt", "ASC"]] });
      const recentGoals = recentGoalsRaw.filter((g: any) => !hiddenIds.has(g.userId)).slice(0, 5);
      const enrichedGoals = await Promise.all(recentGoals.map(async (g: any) => {
        const u = await User.findByPk(g.userId);
        return { ...g.get({ plain: true }), user: u ? u.get({ plain: true }) : null };
      }));

      const leaveBalance = await getLeaveBalance(userId);

      return {
        role,
        totalEmployees: empCount,
        totalManagers: mgrCount,
        activeCycles: activeCount,
        pendingAppraisals: pendingCount,
        awaitingApproval: awaitingApprovalCount,
        completedAppraisals: completedCount,
        myGoals,
        activeGoals,
        recentAppraisals: enrichedAppraisals,
        recentGoals: enrichedGoals,
        leaveBalance,
      };
    } else if (role === "manager") {
      const team = await User.findAll({ where: { managerId: userId, isProtected: false }, attributes: ["id"] });
      const teamIds = team.map((m: any) => m.id);
      // Managers see their own appraisals on the dashboard too (e.g. when
      // another manager reviews them), not just their team's.
      const visibleIds = [userId, ...teamIds];
      const pendingCount = await Appraisal.count({
        where: { employeeId: { [Op.in]: visibleIds }, status: { [Op.in]: ["pending", "self_review"] } },
      });
      const completedCount = await Appraisal.count({
        where: { employeeId: { [Op.in]: visibleIds }, status: "completed" },
      });
      const myGoals = await Goal.count({ where: { userId } });
      const activeGoals = await Goal.count({ where: { userId, status: "in_progress" } });

      const recentAppraisals = await Appraisal.findAll({
        where: { employeeId: { [Op.in]: visibleIds } }, order: [["createdAt", "ASC"]], limit: 5,
      });
      const enrichedAppraisals = await Promise.all(recentAppraisals.map(async (a: any) => {
        const emp = await User.findByPk(a.employeeId);
        const cyc = await Cycle.findByPk(a.cycleId);
        return { ...a.get({ plain: true }), employee: emp ? emp.get({ plain: true }) : null, cycle: cyc ? cyc.get({ plain: true }) : null, reviewer: null };
      }));

      const recentGoals = await Goal.findAll({ where: { userId }, order: [["createdAt", "ASC"]], limit: 5 });
      const enrichedGoals = await Promise.all(recentGoals.map(async (g: any) => {
        const u = await User.findByPk(g.userId);
        return { ...g.get({ plain: true }), user: u ? u.get({ plain: true }) : null };
      }));

      const leaveBalance = await getLeaveBalance(userId);

      return {
        role,
        teamSize: teamIds.length,
        pendingAppraisals: pendingCount,
        completedAppraisals: completedCount,
        myGoals,
        activeGoals,
        recentAppraisals: enrichedAppraisals,
        recentGoals: enrichedGoals,
        leaveBalance,
      };
    } else {
      const myAppraisals = await Appraisal.count({ where: { employeeId: userId } });
      const pendingCount = await Appraisal.count({ where: { employeeId: userId, status: "self_review" } });
      const completedCount = await Appraisal.count({ where: { employeeId: userId, status: "completed" } });
      const myGoals = await Goal.count({ where: { userId } });
      const activeGoals = await Goal.count({ where: { userId, status: "in_progress" } });

      const recentAppraisals = await Appraisal.findAll({ where: { employeeId: userId }, order: [["createdAt", "ASC"]], limit: 5 });
      const enrichedAppraisals = await Promise.all(recentAppraisals.map(async (a: any) => {
        const emp = await User.findByPk(a.employeeId);
        const cyc = await Cycle.findByPk(a.cycleId);
        return { ...a.get({ plain: true }), employee: emp ? emp.get({ plain: true }) : null, cycle: cyc ? cyc.get({ plain: true }) : null, reviewer: null };
      }));

      const recentGoals = await Goal.findAll({ where: { userId }, order: [["createdAt", "ASC"]], limit: 5 });
      const enrichedGoals = await Promise.all(recentGoals.map(async (g: any) => {
        const u = await User.findByPk(g.userId);
        return { ...g.get({ plain: true }), user: u ? u.get({ plain: true }) : null };
      }));

      const leaveBalance = await getLeaveBalance(userId);

      return {
        role,
        pendingAppraisals: pendingCount,
        completedAppraisals: completedCount,
        myGoals,
        activeGoals,
        totalAppraisals: myAppraisals,
        recentAppraisals: enrichedAppraisals,
        recentGoals: enrichedGoals,
        leaveBalance,
      };
    }
  }
}
