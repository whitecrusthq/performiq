import { Op } from "sequelize";
import { User, Cycle, Appraisal, Goal, LeavePolicy, LeaveAllocation, LeaveRequest, LeaveType } from "../models/index.js";

function getCycleKey(policy: any) {
  const today = new Date();
  const year = today.getFullYear();
  const cycleStart = new Date(year, policy.cycleStartMonth - 1, policy.cycleStartDay);
  if (today < cycleStart) {
    return year - 1;
  }
  return year;
}

async function getLeaveBalance(userId: number) {
  const policies = await LeavePolicy.findAll();
  const cycleKeys = [...new Set(policies.map((p: any) => getCycleKey(p)))];
  if (cycleKeys.length === 0) cycleKeys.push(new Date().getFullYear());

  for (const p of policies) {
    const ck = getCycleKey(p);
    const existing = await LeaveAllocation.findOne({
      where: { employeeId: userId, leaveType: (p as any).leaveType, cycleYear: ck },
    });
    if (!existing) {
      await LeaveAllocation.create({
        employeeId: userId,
        leaveType: (p as any).leaveType,
        policyId: (p as any).id,
        allocated: (p as any).daysAllocated,
        used: 0,
        cycleYear: ck,
      });
    }
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
      const empCount = await User.count({ where: { role: "employee" } });
      const mgrCount = await User.count({ where: { role: "manager" } });
      const activeCount = await Cycle.count({ where: { status: "active" } });
      const pendingCount = await Appraisal.count({ where: { status: "pending" } });
      const awaitingApprovalCount = await Appraisal.count({ where: { status: "pending_approval" } });
      const completedCount = await Appraisal.count({ where: { status: "completed" } });
      const myGoals = await Goal.count();
      const activeGoals = await Goal.count({ where: { status: "in_progress" } });

      const recentAppraisals = await Appraisal.findAll({ order: [["createdAt", "ASC"]], limit: 5 });
      const enrichedAppraisals = await Promise.all(recentAppraisals.map(async (a: any) => {
        const emp = await User.findByPk(a.employeeId);
        const cyc = await Cycle.findByPk(a.cycleId);
        return { ...a.get({ plain: true }), employee: emp ? emp.get({ plain: true }) : null, cycle: cyc ? cyc.get({ plain: true }) : null, reviewer: null };
      }));

      const recentGoals = await Goal.findAll({ order: [["createdAt", "ASC"]], limit: 5 });
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
      const team = await User.findAll({ where: { managerId: userId }, attributes: ["id"] });
      const teamIds = team.map((m: any) => m.id);
      const pendingCount = teamIds.length > 0
        ? await Appraisal.count({ where: { employeeId: { [Op.in]: teamIds }, status: "pending" } })
        : 0;
      const completedCount = teamIds.length > 0
        ? await Appraisal.count({ where: { employeeId: { [Op.in]: teamIds }, status: "completed" } })
        : 0;
      const myGoals = await Goal.count({ where: { userId } });
      const activeGoals = await Goal.count({ where: { userId, status: "in_progress" } });

      const recentAppraisals = teamIds.length > 0
        ? await Appraisal.findAll({ where: { employeeId: { [Op.in]: teamIds } }, order: [["createdAt", "ASC"]], limit: 5 })
        : [];
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
