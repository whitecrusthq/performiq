import { Op } from "sequelize";
import { LeaveType, LeaveRequest, LeaveApprover, LeavePolicy, LeaveAllocation, User, EmployeeGrade, LeaveTypeGrade, LeaveHrApprover } from "../models/index.js";
import { getProtectedUserIds } from "../utils/protectedUsers.js";

// Counts working days (Mon–Fri) between two ISO dates inclusive, excluding
// weekends. Authoritative day count so the stored value never trusts the client.
function countWeekdays(start: string, end: string): number {
  const s = new Date(start), e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getUTCDay();
    if (day !== 0 && day !== 6) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

function getCycleKey(policy: { cycleStartMonth: number; cycleStartDay: number; cycleEndMonth: number; cycleEndDay: number }) {
  const today = new Date();
  const year = today.getFullYear();
  const cycleStart = new Date(year, policy.cycleStartMonth - 1, policy.cycleStartDay);
  if (today < cycleStart) {
    return year - 1;
  }
  return year;
}

/**
 * Prorates a policy's annual entitlement for an employee whose resumption
 * (start) date falls inside the current cycle year.
 *  - none:         full entitlement regardless of start date
 *  - monthly:      days ÷ 12 × full months remaining (resumption month counts
 *                  only when resuming on the 1st)
 *  - monthly_incl: days ÷ 12 × months remaining including the resumption month
 */
function prorateAllocation(policy: { daysAllocated: number; prorationMode?: string | null; cycleStartMonth: number; cycleStartDay: number; cycleEndMonth: number; cycleEndDay: number }, employeeStartDate: string | null | undefined, cycleYear?: number): number {
  const total = Number(policy.daysAllocated) || 0;
  const mode = policy.prorationMode ?? "none";
  if (mode === "none" || !employeeStartDate) return total;
  const s = new Date(`${employeeStartDate}T00:00:00Z`);
  if (isNaN(s.getTime())) return total;

  // Concrete boundaries of the target cycle (cycleYear is the year the cycle
  // starts in). Non-calendar cycles (e.g. Jul–Jun) end in the following year.
  const cy = cycleYear ?? getCycleKey(policy as any);
  const cycleStart = new Date(Date.UTC(cy, policy.cycleStartMonth - 1, policy.cycleStartDay));
  const endYear =
    policy.cycleEndMonth < policy.cycleStartMonth ||
    (policy.cycleEndMonth === policy.cycleStartMonth && policy.cycleEndDay < policy.cycleStartDay)
      ? cy + 1
      : cy;
  const cycleEnd = new Date(Date.UTC(endYear, policy.cycleEndMonth - 1, policy.cycleEndDay, 23, 59, 59));

  if (s <= cycleStart) return total;   // resumed on/before this cycle began
  if (s > cycleEnd) return 0;          // resumes after this cycle ends

  // Whole months from the resumption month through the cycle-end month.
  const monthsSpan =
    (cycleEnd.getUTCFullYear() * 12 + cycleEnd.getUTCMonth()) -
    (s.getUTCFullYear() * 12 + s.getUTCMonth()) + 1;
  let months: number;
  if (mode === "monthly_incl") {
    months = monthsSpan;               // resumption month always counts
  } else {                             // monthly: counts only if resuming on the 1st
    months = monthsSpan - (s.getUTCDate() === 1 ? 0 : 1);
  }
  months = Math.max(0, Math.min(12, months));
  return Math.round((total * months) / 12);
}

export default class LeaveController {
  static getCycleKey = getCycleKey;
  static prorateAllocation = prorateAllocation;

  /**
   * Leave-type IDs the given employee may use. A leave type with NO grade
   * mappings is available to everyone; a mapped type only to employees whose
   * grade is in its mapping.
   */
  static async getAllowedLeaveTypeIds(employee: { gradeId?: number | null }): Promise<Set<number>> {
    const [types, mappings] = await Promise.all([
      LeaveType.findAll({ attributes: ["id"] }),
      LeaveTypeGrade.findAll(),
    ]);
    const mappedTypeIds = new Set(mappings.map((m: any) => m.leaveTypeId));
    const allowed = new Set<number>();
    for (const t of types as any[]) {
      if (!mappedTypeIds.has(t.id)) { allowed.add(t.id); continue; }
      if (employee.gradeId && mappings.some((m: any) => m.leaveTypeId === t.id && m.gradeId === employee.gradeId)) {
        allowed.add(t.id);
      }
    }
    return allowed;
  }

  /** True when the employee may request this leave type (by slug). */
  static async isLeaveTypeAllowedForUser(userId: number, leaveTypeSlug: string): Promise<boolean> {
    const type: any = await LeaveType.findOne({ where: { name: leaveTypeSlug } });
    if (!type) return true; // unknown/legacy types are not grade-restricted
    const user: any = await User.findByPk(userId, { attributes: ["id", "gradeId"] });
    const allowed = await LeaveController.getAllowedLeaveTypeIds({ gradeId: user?.gradeId ?? null });
    return allowed.has(type.id);
  }

  static getCurrentCycleYear() {
    return new Date().getFullYear();
  }

  static async ensureAllocation(employeeId: number, leaveType: string, cycleYear?: number) {
    const policy = await LeavePolicy.findOne({ where: { leaveType } });

    const effectiveCycle = cycleYear ?? (policy ? getCycleKey(policy) : new Date().getFullYear());
    let allocated = 0;
    if (policy) {
      const emp: any = await User.findByPk(employeeId, { attributes: ["id", "startDate"] });
      allocated = prorateAllocation(policy, emp?.startDate ?? null, effectiveCycle);
    }
    const policyId = policy ? policy.id : null;

    const existing = await LeaveAllocation.findOne({
      where: { employeeId, leaveType, cycleYear: effectiveCycle },
    });

    if (existing) return existing;

    const alloc = await LeaveAllocation.create({
      employeeId,
      leaveType,
      policyId,
      allocated,
      used: 0,
      cycleYear: effectiveCycle,
    });

    return alloc;
  }

  static async getApproversForRequest(leaveRequestId: number) {
    const rows = await LeaveApprover.findAll({
      where: { leaveRequestId },
      order: [["orderIndex", "ASC"]],
    });
    if (rows.length === 0) return [];
    const approverUsers = await User.findAll({
      where: { id: { [Op.in]: rows.map(r => r.approverId) } },
      attributes: ["id", "name", "email", "department", "jobTitle"],
    });
    const userMap = Object.fromEntries(approverUsers.map(u => [u.id, { id: u.id, name: u.name, email: u.email, department: u.department, jobTitle: u.jobTitle }]));
    return rows.map(row => ({
      id: row.approverId,
      orderIndex: row.orderIndex,
      status: row.status,
      note: row.note,
      reviewedAt: row.reviewedAt,
      approver: userMap[row.approverId] ?? null,
    }));
  }

  static async enrichLeaveRequest(r: any, userMap: Record<number, any>, hiddenIds?: Set<number>) {
    let approvers = await LeaveController.getApproversForRequest(r.id);
    // Protected participants stay hidden below super admin.
    if (hiddenIds && hiddenIds.size > 0) approvers = approvers.filter(a => !hiddenIds.has(a.id));
    const currentApprover = approvers.find(a => a.status === "pending") ?? null;
    const coverers: any[] = [];
    if (r.coverUserId1 && !(hiddenIds && hiddenIds.has(r.coverUserId1))) {
      coverers.push({
        ...(userMap[r.coverUserId1] ?? { id: r.coverUserId1, name: `User #${r.coverUserId1}` }),
        status: r.coverUser1Status ?? "pending",
        respondedAt: r.coverUser1RespondedAt ?? null,
        note: r.coverUser1Note ?? null,
      });
    }
    if (r.coverUserId2 && !(hiddenIds && hiddenIds.has(r.coverUserId2))) {
      coverers.push({
        ...(userMap[r.coverUserId2] ?? { id: r.coverUserId2, name: `User #${r.coverUserId2}` }),
        status: r.coverUser2Status ?? "pending",
        respondedAt: r.coverUser2RespondedAt ?? null,
        note: r.coverUser2Note ?? null,
      });
    }
    return {
      ...r.toJSON ? r.toJSON() : r,
      employee: userMap[r.employeeId] ?? null,
      reviewer: r.reviewerId && !(hiddenIds && hiddenIds.has(r.reviewerId)) ? (userMap[r.reviewerId] ?? null) : null,
      approvers,
      currentApproverId: currentApprover?.id ?? null,
      coverers,
    };
  }

  static async listLeaveTypes(forUserId?: number) {
    const types = await LeaveType.findAll({ order: [["name", "ASC"]] });
    const mappings = await LeaveTypeGrade.findAll();
    const gradeIdsByType = new Map<number, number[]>();
    for (const m of mappings as any[]) {
      const list = gradeIdsByType.get(m.leaveTypeId) ?? [];
      list.push(m.gradeId);
      gradeIdsByType.set(m.leaveTypeId, list);
    }
    let allowed: Set<number> | null = null;
    if (forUserId) {
      const user: any = await User.findByPk(forUserId, { attributes: ["id", "gradeId"] });
      allowed = await LeaveController.getAllowedLeaveTypeIds({ gradeId: user?.gradeId ?? null });
    }
    return types
      .filter((t: any) => !allowed || allowed.has(t.id))
      .map((t: any) => ({ ...t.toJSON(), gradeIds: gradeIdsByType.get(t.id) ?? [] }));
  }

  static async setLeaveTypeGrades(leaveTypeId: number, gradeIds: number[] | undefined) {
    if (!Array.isArray(gradeIds)) return;
    await LeaveTypeGrade.destroy({ where: { leaveTypeId } });
    const unique = [...new Set(gradeIds.map(Number).filter(n => Number.isInteger(n) && n > 0))];
    if (unique.length > 0) {
      await LeaveTypeGrade.bulkCreate(unique.map(gradeId => ({ leaveTypeId, gradeId })));
    }
  }

  static async createLeaveType(name: string, label: string, gradeIds?: number[]) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!slug) return { error: "Invalid name", status: 400 };
    const existing = await LeaveType.findOne({ where: { name: slug } });
    if (existing) return { error: "A leave type with this name already exists", status: 400 };
    const created = await LeaveType.create({ name: slug, label });
    await LeaveController.setLeaveTypeGrades(created.id, gradeIds);
    return { data: created };
  }

  static async updateLeaveType(id: number, label: string, gradeIds?: number[]) {
    const [count, rows] = await LeaveType.update({ label }, { where: { id }, returning: true });
    if (count === 0) return null;
    await LeaveController.setLeaveTypeGrades(id, gradeIds);
    return rows[0];
  }

  // ---- Employee grades (categories) ----
  static async listGrades() {
    return EmployeeGrade.findAll({ order: [["name", "ASC"]] });
  }

  static async createGrade(name: string, description?: string) {
    const trimmed = (name ?? "").trim();
    if (!trimmed) return { error: "Grade name is required", status: 400 };
    const existing = await EmployeeGrade.findOne({ where: { name: trimmed } });
    if (existing) return { error: "A grade with this name already exists", status: 400 };
    const created = await EmployeeGrade.create({ name: trimmed, description: description || null });
    return { data: created };
  }

  static async updateGrade(id: number, name: string, description?: string) {
    const trimmed = (name ?? "").trim();
    if (!trimmed) return { error: "Grade name is required", status: 400 };
    const dupe = await EmployeeGrade.findOne({ where: { name: trimmed, id: { [Op.ne]: id } } });
    if (dupe) return { error: "A grade with this name already exists", status: 400 };
    const [count, rows] = await EmployeeGrade.update(
      { name: trimmed, description: description || null },
      { where: { id }, returning: true }
    );
    if (count === 0) return { error: "Not found", status: 404 };
    return { data: rows[0] };
  }

  static async deleteGrade(id: number) {
    await EmployeeGrade.destroy({ where: { id } });
    return { success: true };
  }

  static async deleteLeaveType(id: number) {
    const row = await LeaveType.findByPk(id);
    if (!row) return { error: "Not found", status: 404 };
    if (row.isDefault) return { error: "Cannot delete a default leave type", status: 400 };
    await LeaveType.destroy({ where: { id: row.id } });
    return { success: true };
  }

  static async listPolicies(user?: { id: number; role: string; customRoleName?: string | null }) {
    const policies = await LeavePolicy.findAll({ order: [["leaveType", "ASC"]] });
    if (!user) return policies;

    const visibleIds = await LeaveController.getVisibleEmployeeIds(user.id, user.role, user.customRoleName);
    if (visibleIds === null) return policies;

    const allocations = await LeaveAllocation.findAll({
      where: { employeeId: visibleIds },
      attributes: ["leaveType"],
    });
    const applicableTypes = new Set(allocations.map((a: any) => a.leaveType));
    return policies.filter(p => applicableTypes.has(p.leaveType));
  }

  static async upsertPolicy(data: { leaveType: string; daysAllocated: number; cycleStartMonth?: number; cycleStartDay?: number; cycleEndMonth?: number; cycleEndDay?: number; prorationMode?: string }) {
    const { leaveType, daysAllocated, cycleStartMonth, cycleStartDay, cycleEndMonth, cycleEndDay } = data;
    const prorationMode = ["none", "monthly", "monthly_incl"].includes(data.prorationMode ?? "")
      ? data.prorationMode
      : "none";
    const existing = await LeavePolicy.findOne({ where: { leaveType } });

    let policy;
    if (existing) {
      const [, rows] = await LeavePolicy.update({
        daysAllocated: Number(daysAllocated),
        cycleStartMonth: Number(cycleStartMonth) || 1,
        cycleStartDay: Number(cycleStartDay) || 1,
        cycleEndMonth: Number(cycleEndMonth) || 12,
        cycleEndDay: Number(cycleEndDay) || 31,
        prorationMode,
        updatedAt: new Date(),
      }, { where: { id: existing.id }, returning: true });
      policy = rows[0];
    } else {
      policy = await LeavePolicy.create({
        leaveType,
        daysAllocated: Number(daysAllocated),
        cycleStartMonth: Number(cycleStartMonth) || 1,
        cycleStartDay: Number(cycleStartDay) || 1,
        cycleEndMonth: Number(cycleEndMonth) || 12,
        cycleEndDay: Number(cycleEndDay) || 31,
        prorationMode,
      });
    }

    const cycleYear = getCycleKey(policy);
    const employees = await User.findAll({ attributes: ["id", "startDate"] });
    for (const emp of employees as any[]) {
      const allocated = prorateAllocation(policy, emp.startDate ?? null, cycleYear);
      const existingAlloc = await LeaveAllocation.findOne({
        where: { employeeId: emp.id, leaveType, cycleYear },
      });

      if (existingAlloc) {
        // Never overwrite an admin's manual adjustment when re-prorating.
        if (!existingAlloc.isManual) {
          await LeaveAllocation.update({
            allocated,
            policyId: policy.id,
            updatedAt: new Date(),
          }, { where: { id: existingAlloc.id } });
        }
      } else {
        await LeaveAllocation.create({
          employeeId: emp.id,
          leaveType,
          policyId: policy.id,
          allocated,
          used: 0,
          cycleYear,
        });
      }
    }

    return policy;
  }

  static async deletePolicy(id: number) {
    await LeavePolicy.destroy({ where: { id } });
  }

  static async getLeaveBalance(userId: number) {
    const policies = await LeavePolicy.findAll();
    const policyMap = Object.fromEntries(policies.map(p => [p.leaveType, p]));

    for (const p of policies) {
      await LeaveController.ensureAllocation(userId, p.leaveType);
    }

    const cycleKeys = [...new Set(policies.map(p => getCycleKey(p)))];
    if (cycleKeys.length === 0) cycleKeys.push(new Date().getFullYear());

    const allAllocations: any[] = [];
    for (const ck of cycleKeys) {
      const rows = await LeaveAllocation.findAll({
        where: { employeeId: userId, cycleYear: ck },
      });
      allAllocations.push(...rows.map(r => r.toJSON()));
    }

    const seen = new Set<string>();
    const dedupedAllocations = allAllocations.filter(a => {
      const key = a.leaveType;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const balances = dedupedAllocations.map(a => ({
      leaveType: a.leaveType,
      allocated: a.allocated,
      used: a.used,
      remaining: a.allocated - a.used,
      policy: policyMap[a.leaveType] || null,
      cycleYear: a.cycleYear,
    }));

    return { cycleYear: cycleKeys[0], balances };
  }

  /**
   * Department-based leave visibility scope.
   *  - super_admin / admin: sees everyone (returns null = no restriction).
   *  - manager or HR (custom role "hr manager"): sees everyone in their OWN department (+ self).
   *  - everyone else (regular employees): sees only themselves.
   * A department-scoped user with no department falls back to self-only.
   */
  static async getVisibleEmployeeIds(userId: number, role: string, customRoleName?: string | null): Promise<number[] | null> {
    if (role === "admin" || role === "super_admin") return null;
    const isHR = !!customRoleName && customRoleName.toLowerCase() === "hr manager";
    if (role === "manager" || isHR) {
      const me = await User.findByPk(userId, { attributes: ["id", "department"] });
      const dept = (me as any)?.department ?? null;
      if (!dept) return [userId];
      const peers = await User.findAll({ where: { department: dept }, attributes: ["id"] });
      return [...new Set([userId, ...peers.map(p => p.id)])];
    }
    return [userId];
  }

  static async getTeamBalance(userId: number, role: string, customRoleName?: string | null) {
    const policies = await LeavePolicy.findAll();
    const policyMap = Object.fromEntries(policies.map(p => [p.leaveType, p]));
    const cycleKeys = [...new Set(policies.map(p => getCycleKey(p)))];
    if (cycleKeys.length === 0) cycleKeys.push(new Date().getFullYear());
    const cycleYear = cycleKeys[0];

    const visibleIds = await LeaveController.getVisibleEmployeeIds(userId, role, customRoleName);
    let employeeIds: number[];
    if (visibleIds === null) {
      const allEmployees = await User.findAll({ attributes: ["id"] });
      employeeIds = allEmployees.map(e => e.id);
    } else {
      employeeIds = visibleIds;
    }
    if (role !== "super_admin") {
      // Balances of protected accounts stay hidden below super admin
      // (a protected viewer still sees their own balance).
      const protectedIds = await getProtectedUserIds(userId);
      employeeIds = employeeIds.filter(id => !protectedIds.has(id));
    }

    if (employeeIds.length === 0) {
      return { cycleYear, employees: [] };
    }

    for (const empId of employeeIds) {
      for (const p of policies) {
        await LeaveController.ensureAllocation(empId, p.leaveType);
      }
    }

    const users = await User.findAll({
      where: { id: { [Op.in]: employeeIds } },
      attributes: ["id", "name", "department", "jobTitle"],
    });

    const allAllocations: any[] = [];
    for (const ck of cycleKeys) {
      const rows = await LeaveAllocation.findAll({
        where: { employeeId: { [Op.in]: employeeIds }, cycleYear: ck },
      });
      allAllocations.push(...rows.map(r => r.toJSON()));
    }

    const employeeBalances = users.map(u => {
      const uJson = u.toJSON() as any;
      const empAllocs = allAllocations.filter(a => a.employeeId === uJson.id);
      const seen = new Set<string>();
      const deduped = empAllocs.filter(a => {
        if (seen.has(a.leaveType)) return false;
        seen.add(a.leaveType);
        return true;
      });
      return {
        ...uJson,
        balances: deduped.map(a => ({
          leaveType: a.leaveType,
          allocated: a.allocated,
          used: a.used,
          remaining: a.allocated - a.used,
          policy: policyMap[a.leaveType] || null,
        })),
      };
    });

    return { cycleYear, employees: employeeBalances };
  }

  static async listLeaveRequests(userId: number, role: string, customRoleName?: string | null, department?: string, employeeId?: number) {
    let rows = await LeaveRequest.findAll({ order: [["createdAt", "DESC"]] });

    // Department-based scoping. admin/super_admin (visibleIds === null) see all.
    // Everyone else sees: requests from employees in their visible scope, plus any
    // request where they are personally involved as an approver or cover officer.
    const visibleIds = await LeaveController.getVisibleEmployeeIds(userId, role, customRoleName);
    if (visibleIds !== null) {
      const visibleSet = new Set(visibleIds);
      const approverRows = await LeaveApprover.findAll({
        where: { approverId: userId },
        attributes: ["leaveRequestId"],
      });
      const approverRequestIds = new Set(approverRows.map(a => a.leaveRequestId));
      rows = rows.filter(r =>
        visibleSet.has(r.employeeId) ||
        approverRequestIds.has(r.id) ||
        r.coverUserId1 === userId ||
        r.coverUserId2 === userId
      );
    }

    // Requests from protected accounts stay hidden below super admin, except
    // for the protected user themself or someone personally involved as an
    // approver or cover officer (they need the request to act on it).
    const hiddenIds = role === "super_admin" ? new Set<number>() : await getProtectedUserIds(userId);
    if (hiddenIds.size > 0) {
      const myApproverRows = await LeaveApprover.findAll({
        where: { approverId: userId },
        attributes: ["leaveRequestId"],
      });
      const myApprovals = new Set(myApproverRows.map(a => a.leaveRequestId));
      rows = rows.filter(r =>
        !hiddenIds.has(r.employeeId) ||
        myApprovals.has(r.id) ||
        r.coverUserId1 === userId ||
        r.coverUserId2 === userId
      );
    }

    const allUserIds = [...new Set([
      ...rows.map(r => r.employeeId),
      ...rows.map(r => r.reviewerId).filter(Boolean) as number[],
      ...rows.map(r => r.coverUserId1).filter(Boolean) as number[],
      ...rows.map(r => r.coverUserId2).filter(Boolean) as number[],
    ])];
    const users = allUserIds.length > 0
      ? await User.findAll({
          where: { id: { [Op.in]: allUserIds } },
          attributes: ["id", "name", "email", "department", "jobTitle", "siteId"],
        })
      : [];
    const userMap = Object.fromEntries(users.map(u => [u.id, u.toJSON()]));

    if (department) {
      rows = rows.filter(r => {
        const emp = userMap[r.employeeId];
        return emp && emp.department === department;
      });
    }

    if (employeeId) {
      rows = rows.filter(r => r.employeeId === employeeId);
    }

    return Promise.all(rows.map(r => LeaveController.enrichLeaveRequest(r, userMap, hiddenIds)));
  }

  /** Protected user ids the viewer must never see; empty for super admins. */
  static async hiddenIdsForViewer(viewerId: number, viewerRole?: string): Promise<Set<number>> {
    if (viewerRole === "super_admin") return new Set();
    return getProtectedUserIds(viewerId);
  }

  static async createLeaveRequest(userId: number, data: { leaveType: string; startDate: string; endDate: string; reason?: string; approverIds?: number[]; coverUserIds?: number[]; includeHrApprover?: boolean }, viewerRole?: string) {
    const { leaveType, startDate, endDate, reason, approverIds, coverUserIds } = data;

    // Grade restriction: employees may only request leave types mapped to
    // their grade (unmapped types are open to everyone).
    const typeAllowed = await LeaveController.isLeaveTypeAllowedForUser(userId, leaveType);
    if (!typeAllowed) {
      return { error: "This leave type is not available for your employee grade.", status: 403 };
    }

    // Authoritative: count working days (Mon–Fri) only, never trust the client value.
    const days = countWeekdays(startDate, endDate);
    if (days <= 0) {
      return { error: "The selected dates contain no working days (weekends are not counted).", status: 400 };
    }

    const cleanCoverers = Array.isArray(coverUserIds)
      ? Array.from(new Set(coverUserIds.map(Number).filter(v => Number.isFinite(v) && v !== userId)))
      : [];
    const coverUserId1 = cleanCoverers[0] ?? null;
    const coverUserId2 = cleanCoverers[1] ?? null;

    const row = await LeaveRequest.create({
      employeeId: userId,
      leaveType,
      startDate,
      endDate,
      days,
      reason: reason || null,
      status: "pending",
      coverUserId1,
      coverUserId2,
    });

    let orderedApproverIds: number[] = Array.isArray(approverIds) && approverIds.length > 0
      ? approverIds.map(Number).filter(Boolean)
      : [];

    if (orderedApproverIds.length === 0) {
      const emp = await User.findOne({ where: { id: userId }, attributes: ["managerId"] });
      if (emp?.managerId) orderedApproverIds = [emp.managerId];
    }

    // The assigned HR approver (designated by an admin from the configured
    // list) is suggested as the final approval step but is NOT compulsory:
    // the applicant can opt out (includeHrApprover: false). The admin — not
    // the employee — decides who handles the HR step. Skipped when they are
    // the requester or already in the chain.
    if (data.includeHrApprover !== false) {
      const chosen = await LeaveController.getAssignedHrApproverId();
      if (chosen && chosen !== userId && !orderedApproverIds.includes(chosen)) {
        orderedApproverIds.push(chosen);
      }
    }

    if (orderedApproverIds.length > 0) {
      await LeaveApprover.bulkCreate(
        orderedApproverIds.map((aid, idx) => ({
          leaveRequestId: row.id,
          approverId: aid,
          orderIndex: idx,
          status: "pending",
        })),
        { ignoreDuplicates: true }
      );
      await LeaveRequest.update({ reviewerId: orderedApproverIds[0] }, { where: { id: row.id } });
    }

    const allIds = [userId, ...orderedApproverIds, ...cleanCoverers];
    const users = await User.findAll({
      where: { id: { [Op.in]: allIds } },
      attributes: ["id", "name", "email", "department", "jobTitle"],
    });
    const userMap: Record<number, any> = {};
    users.forEach(u => { userMap[u.id] = u.toJSON(); });

    const enriched = await LeaveController.enrichLeaveRequest(row, userMap, await LeaveController.hiddenIdsForViewer(userId, viewerRole));

    return { enriched, orderedApproverIds, userMap, row: row.toJSON() };
  }

  /** Admin override of an employee's allocated days for a leave type (survives policy re-saves). */
  static async adjustAllocation(employeeId: number, leaveType: string, allocated: number) {
    const emp = await User.findByPk(employeeId, { attributes: ["id"] });
    if (!emp) return { error: "Employee not found", status: 404 };
    const type = await LeaveType.findOne({ where: { name: leaveType } });
    const policy = await LeavePolicy.findOne({ where: { leaveType } });
    if (!type && !policy) return { error: "Unknown leave type", status: 400 };
    const alloc = await LeaveController.ensureAllocation(employeeId, leaveType);
    await LeaveAllocation.update(
      { allocated, isManual: true, updatedAt: new Date() },
      { where: { id: alloc.id } }
    );
    const updated = await LeaveAllocation.findByPk(alloc.id);
    return { data: updated!.toJSON() };
  }

  /** Configured HR approver rows whose users are still active, in configured order. */
  static async getActiveHrApproverRows(): Promise<{ userId: number; isDefault: boolean }[]> {
    const rows = await LeaveHrApprover.findAll({ order: [["position", "ASC"], ["userId", "ASC"]] });
    if (rows.length === 0) return [];
    const users = await User.findAll({
      where: { id: { [Op.in]: rows.map(r => r.userId) } },
      attributes: ["id", "isActive"],
    });
    const active = new Set(users.filter((u: any) => u.isActive !== false).map(u => u.id));
    return rows.filter(r => active.has(r.userId)).map(r => ({ userId: r.userId, isDefault: r.isDefault }));
  }

  /** The HR person the admin assigned to handle final approvals (falls back to first configured). */
  static async getAssignedHrApproverId(): Promise<number | null> {
    const rows = await LeaveController.getActiveHrApproverRows();
    if (rows.length === 0) return null;
    return (rows.find(r => r.isDefault) ?? rows[0]).userId;
  }

  static async listHrLeaveApprovers(viewer?: { id: number; role: string }) {
    const rows = await LeaveController.getActiveHrApproverRows();
    if (rows.length === 0) return [];
    const assignedId = (rows.find(r => r.isDefault) ?? rows[0]).userId;
    // Protected configured approvers stay hidden below super admin (except self).
    const hiddenIds = viewer ? await LeaveController.hiddenIdsForViewer(viewer.id, viewer.role) : new Set<number>();
    const users = await User.findAll({
      where: { id: { [Op.in]: rows.map(r => r.userId).filter(id => !hiddenIds.has(id)) } },
      attributes: ["id", "name", "department", "jobTitle"],
    });
    const byId: Record<number, any> = {};
    users.forEach(u => { byId[u.id] = u.toJSON(); });
    return rows.map(r => byId[r.userId] ? { ...byId[r.userId], isAssigned: r.userId === assignedId } : null).filter(Boolean);
  }

  static async setHrLeaveApprovers(userIds: number[], assignedUserId?: number | null) {
    const unique = [...new Set(userIds.map(Number))].filter(n => Number.isInteger(n) && n > 0);
    if (unique.length > 0) {
      const found = await User.count({ where: { id: { [Op.in]: unique } } });
      if (found !== unique.length) return { error: "One or more users not found", status: 400 };
    }
    const assigned = assignedUserId != null && unique.includes(Number(assignedUserId)) ? Number(assignedUserId) : unique[0] ?? null;
    await LeaveHrApprover.destroy({ where: {} });
    if (unique.length > 0) {
      await LeaveHrApprover.bulkCreate(unique.map((id, idx) => ({ userId: id, position: idx, isDefault: id === assigned })));
    }
    return { data: { userIds: unique, assignedUserId: assigned } };
  }

  static async getLeaveRequest(requestId: number) {
    return LeaveRequest.findByPk(requestId);
  }

  static async respondToCover(requestId: number, userId: number, decision: "agreed" | "declined", note?: string, viewerRole?: string) {
    const row = await LeaveRequest.findByPk(requestId);
    if (!row) return { error: "Not found", status: 404 };
    if (row.status !== "pending") return { error: "Only pending requests can receive cover responses", status: 400 };

    let slot: 1 | 2 | null = null;
    if (row.coverUserId1 === userId) slot = 1;
    else if (row.coverUserId2 === userId) slot = 2;
    if (!slot) return { error: "You are not nominated as a cover officer on this request", status: 403 };

    const currentStatus = slot === 1 ? row.coverUser1Status : row.coverUser2Status;
    if (currentStatus === "agreed" || currentStatus === "declined") {
      return { error: `You have already responded (${currentStatus})`, status: 400 };
    }

    if (decision !== "agreed" && decision !== "declined") {
      return { error: "decision must be 'agreed' or 'declined'", status: 400 };
    }

    const updates: any = { updatedAt: new Date() };
    if (slot === 1) {
      updates.coverUser1Status = decision;
      updates.coverUser1RespondedAt = new Date();
      updates.coverUser1Note = note ? String(note).slice(0, 500) : null;
    } else {
      updates.coverUser2Status = decision;
      updates.coverUser2RespondedAt = new Date();
      updates.coverUser2Note = note ? String(note).slice(0, 500) : null;
    }
    const [, updatedRows] = await LeaveRequest.update(updates, { where: { id: row.id }, returning: true });
    const updated = updatedRows[0];

    const lookupIds = [
      updated.employeeId,
      ...(updated.coverUserId1 ? [updated.coverUserId1] : []),
      ...(updated.coverUserId2 ? [updated.coverUserId2] : []),
    ];
    const users = await User.findAll({
      where: { id: { [Op.in]: lookupIds } },
      attributes: ["id", "name", "email", "department", "jobTitle"],
    });
    const userMap: Record<number, any> = {};
    users.forEach(u => { userMap[u.id] = u.toJSON(); });

    return {
      data: await LeaveController.enrichLeaveRequest(updated, userMap, await LeaveController.hiddenIdsForViewer(userId, viewerRole)),
      employee: userMap[updated.employeeId] ?? null,
      slot,
    };
  }

  static async updateLeaveRequest(requestId: number, userId: number, role: string, data: { status: string; reviewNote?: string }) {
    const row = await LeaveRequest.findByPk(requestId);
    if (!row) return { error: "Not found", status: 404 };

    const { status, reviewNote } = data;

    if (status === "cancelled") {
      if (row.employeeId !== userId) return { error: "Only the applicant can cancel", status: 403 };
      if (row.status !== "pending" && row.status !== "approved") return { error: "Only pending requests can be cancelled", status: 400 };

      if (row.status === "approved") {
        const alloc = await LeaveController.ensureAllocation(row.employeeId, row.leaveType);
        await LeaveAllocation.update({
          used: Math.max(0, alloc.used - row.days),
          updatedAt: new Date(),
        }, { where: { id: alloc.id } });
      }

      const [, updatedRows] = await LeaveRequest.update(
        { status: "cancelled", updatedAt: new Date() },
        { where: { id: row.id }, returning: true }
      );
      const userMap: Record<number, any> = {};
      return { data: await LeaveController.enrichLeaveRequest(updatedRows[0], userMap, await LeaveController.hiddenIdsForViewer(userId, role)) };
    }

    if (status === "approved" || status === "rejected") {
      if (row.status !== "pending") return { error: "Only pending requests can be reviewed", status: 400 };

      const approverRows = await LeaveApprover.findAll({
        where: { leaveRequestId: row.id, status: "pending" },
        order: [["orderIndex", "ASC"]],
        limit: 1,
      });

      // Admins can always review; otherwise the reviewer must be the request's
      // current (first pending) approver — regardless of their system role, so
      // designated approvers such as the HR approver can act even when their
      // role is "employee".
      const isAdmin = role === "admin" || role === "super_admin";
      const isCurrentApprover = approverRows.length > 0 && approverRows[0].approverId === userId;
      if (!isAdmin && !isCurrentApprover) {
        return { error: "You are not the current approver for this request", status: 403 };
      }

      const empUser = await User.findOne({
        where: { id: row.employeeId },
        attributes: ["id", "name", "email"],
      });

      if (status === "rejected") {
        if (approverRows.length > 0) {
          await LeaveApprover.update(
            { status: "rejected", note: reviewNote || null, reviewedAt: new Date() },
            { where: { id: approverRows[0].id } }
          );
        }
        const [, updatedRows] = await LeaveRequest.update(
          { status: "rejected", reviewerId: userId, reviewNote: reviewNote || null, updatedAt: new Date() },
          { where: { id: row.id }, returning: true }
        );

        const userMap: Record<number, any> = {};
        return {
          data: await LeaveController.enrichLeaveRequest(updatedRows[0], userMap, await LeaveController.hiddenIdsForViewer(userId, role)),
          notifyEvent: "rejected" as const,
          empUser: empUser?.toJSON(),
          row: row.toJSON(),
          reviewNote,
        };
      }

      const otherPending = await LeaveApprover.count({
        where: {
          leaveRequestId: row.id,
          status: "pending",
          ...(approverRows.length > 0 ? { id: { [Op.ne]: approverRows[0].id } } : {}),
        },
      });
      const wouldBeFinalApproval = otherPending === 0;

      if (wouldBeFinalApproval) {
        const coverPending: string[] = [];
        if (row.coverUserId1 && row.coverUser1Status !== "agreed") {
          coverPending.push(`Cover Officer 1 has not agreed (status: ${row.coverUser1Status})`);
        }
        if (row.coverUserId2 && row.coverUser2Status !== "agreed") {
          coverPending.push(`Cover Officer 2 has not agreed (status: ${row.coverUser2Status})`);
        }
        if (coverPending.length > 0) {
          return {
            error: `Cannot finalize approval: ${coverPending.join("; ")}. The applicant must wait for cover officers to agree, or cancel and re-submit.`,
            status: 400,
          };
        }
      }

      if (approverRows.length > 0) {
        await LeaveApprover.update(
          { status: "approved", note: reviewNote || null, reviewedAt: new Date() },
          { where: { id: approverRows[0].id } }
        );
      }

      const remaining = await LeaveApprover.findAll({
        where: { leaveRequestId: row.id, status: "pending" },
        order: [["orderIndex", "ASC"]],
        limit: 1,
      });

      let finalStatus: "pending" | "approved" = remaining.length > 0 ? "pending" : "approved";
      const nextApproverId = remaining.length > 0 ? remaining[0].approverId : null;

      const [, updatedRows] = await LeaveRequest.update({
        status: finalStatus,
        reviewerId: nextApproverId ?? userId,
        reviewNote: finalStatus === "approved" ? (reviewNote || null) : null,
        updatedAt: new Date(),
      }, { where: { id: row.id }, returning: true });

      if (finalStatus === "approved") {
        const alloc = await LeaveController.ensureAllocation(row.employeeId, row.leaveType);
        await LeaveAllocation.update({
          used: alloc.used + row.days,
          updatedAt: new Date(),
        }, { where: { id: alloc.id } });
      }

      let nextApprover = null;
      if (nextApproverId) {
        nextApprover = await User.findOne({
          where: { id: nextApproverId },
          attributes: ["id", "name", "email"],
        });
      }

      const userMap: Record<number, any> = {};
      return {
        data: await LeaveController.enrichLeaveRequest(updatedRows[0], userMap, await LeaveController.hiddenIdsForViewer(userId, role)),
        notifyEvent: finalStatus === "approved" ? "approved" as const : "awaiting_next" as const,
        empUser: empUser?.toJSON(),
        row: row.toJSON(),
        reviewNote,
        nextApproverId,
        nextApprover: nextApprover?.toJSON(),
        finalStatus,
      };
    }

    return { error: "Invalid status", status: 400 };
  }

  static async deleteLeaveRequest(id: number) {
    await LeaveRequest.destroy({ where: { id } });
  }
}
