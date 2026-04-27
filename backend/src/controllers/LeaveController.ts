import { Op } from "sequelize";
import { LeaveType, LeaveRequest, LeaveApprover, LeavePolicy, LeaveAllocation, User } from "../models/index.js";

function getCycleKey(policy: { cycleStartMonth: number; cycleStartDay: number; cycleEndMonth: number; cycleEndDay: number }) {
  const today = new Date();
  const year = today.getFullYear();
  const cycleStart = new Date(year, policy.cycleStartMonth - 1, policy.cycleStartDay);
  if (today < cycleStart) {
    return year - 1;
  }
  return year;
}

export default class LeaveController {
  static getCycleKey = getCycleKey;

  static getCurrentCycleYear() {
    return new Date().getFullYear();
  }

  static async ensureAllocation(employeeId: number, leaveType: string, cycleYear?: number) {
    const policy = await LeavePolicy.findOne({ where: { leaveType } });

    const effectiveCycle = cycleYear ?? (policy ? getCycleKey(policy) : new Date().getFullYear());
    const allocated = policy ? policy.daysAllocated : 0;
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

  static async enrichLeaveRequest(r: any, userMap: Record<number, any>) {
    const approvers = await LeaveController.getApproversForRequest(r.id);
    const currentApprover = approvers.find(a => a.status === "pending") ?? null;
    const coverers: any[] = [];
    if (r.coverUserId1) {
      coverers.push({
        ...(userMap[r.coverUserId1] ?? { id: r.coverUserId1, name: `User #${r.coverUserId1}` }),
        status: r.coverUser1Status ?? "pending",
        respondedAt: r.coverUser1RespondedAt ?? null,
        note: r.coverUser1Note ?? null,
      });
    }
    if (r.coverUserId2) {
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
      reviewer: r.reviewerId ? (userMap[r.reviewerId] ?? null) : null,
      approvers,
      currentApproverId: currentApprover?.id ?? null,
      coverers,
    };
  }

  static async listLeaveTypes() {
    return LeaveType.findAll({ order: [["name", "ASC"]] });
  }

  static async createLeaveType(name: string, label: string) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!slug) return { error: "Invalid name", status: 400 };
    const existing = await LeaveType.findOne({ where: { name: slug } });
    if (existing) return { error: "A leave type with this name already exists", status: 400 };
    const created = await LeaveType.create({ name: slug, label });
    return { data: created };
  }

  static async updateLeaveType(id: number, label: string) {
    const [count, rows] = await LeaveType.update({ label }, { where: { id }, returning: true });
    if (count === 0) return null;
    return rows[0];
  }

  static async deleteLeaveType(id: number) {
    const row = await LeaveType.findByPk(id);
    if (!row) return { error: "Not found", status: 404 };
    if (row.isDefault) return { error: "Cannot delete a default leave type", status: 400 };
    await LeaveType.destroy({ where: { id: row.id } });
    return { success: true };
  }

  static async listPolicies() {
    return LeavePolicy.findAll({ order: [["leaveType", "ASC"]] });
  }

  static async upsertPolicy(data: { leaveType: string; daysAllocated: number; cycleStartMonth?: number; cycleStartDay?: number; cycleEndMonth?: number; cycleEndDay?: number }) {
    const { leaveType, daysAllocated, cycleStartMonth, cycleStartDay, cycleEndMonth, cycleEndDay } = data;
    const existing = await LeavePolicy.findOne({ where: { leaveType } });

    let policy;
    if (existing) {
      const [, rows] = await LeavePolicy.update({
        daysAllocated: Number(daysAllocated),
        cycleStartMonth: Number(cycleStartMonth) || 1,
        cycleStartDay: Number(cycleStartDay) || 1,
        cycleEndMonth: Number(cycleEndMonth) || 12,
        cycleEndDay: Number(cycleEndDay) || 31,
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
      });
    }

    const cycleYear = getCycleKey(policy);
    const employees = await User.findAll({ attributes: ["id"] });
    for (const emp of employees) {
      const existingAlloc = await LeaveAllocation.findOne({
        where: { employeeId: emp.id, leaveType, cycleYear },
      });

      if (existingAlloc) {
        await LeaveAllocation.update({
          allocated: Number(daysAllocated),
          policyId: policy.id,
          updatedAt: new Date(),
        }, { where: { id: existingAlloc.id } });
      } else {
        await LeaveAllocation.create({
          employeeId: emp.id,
          leaveType,
          policyId: policy.id,
          allocated: Number(daysAllocated),
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

  static async getTeamBalance(userId: number, role: string) {
    const policies = await LeavePolicy.findAll();
    const policyMap = Object.fromEntries(policies.map(p => [p.leaveType, p]));
    const cycleKeys = [...new Set(policies.map(p => getCycleKey(p)))];
    if (cycleKeys.length === 0) cycleKeys.push(new Date().getFullYear());
    const cycleYear = cycleKeys[0];

    let employeeIds: number[];
    if (role === "admin" || role === "super_admin") {
      const allEmployees = await User.findAll({ attributes: ["id"] });
      employeeIds = allEmployees.map(e => e.id);
    } else if (role === "manager") {
      const team = await User.findAll({ where: { managerId: userId }, attributes: ["id"] });
      employeeIds = [userId, ...team.map(t => t.id)];
    } else {
      employeeIds = [userId];
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

  static async listLeaveRequests(userId: number, role: string, department?: string, employeeId?: number) {
    let rows = await LeaveRequest.findAll({ order: [["createdAt", "DESC"]] });

    if (role === "employee") {
      rows = rows.filter(r =>
        r.employeeId === userId ||
        r.coverUserId1 === userId ||
        r.coverUserId2 === userId
      );
    } else if (role === "manager") {
      const subordinates = await User.findAll({ where: { managerId: userId }, attributes: ["id"] });
      const subIds = new Set([userId, ...subordinates.map(s => s.id)]);
      const approverRows = await LeaveApprover.findAll({
        where: { approverId: userId },
        attributes: ["leaveRequestId"],
      });
      const approverRequestIds = new Set(approverRows.map(a => a.leaveRequestId));
      rows = rows.filter(r =>
        subIds.has(r.employeeId) ||
        approverRequestIds.has(r.id) ||
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
          attributes: ["id", "name", "email", "department", "jobTitle"],
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

    return Promise.all(rows.map(r => LeaveController.enrichLeaveRequest(r, userMap)));
  }

  static async createLeaveRequest(userId: number, data: { leaveType: string; startDate: string; endDate: string; days: number; reason?: string; approverIds?: number[]; coverUserIds?: number[] }) {
    const { leaveType, startDate, endDate, days, reason, approverIds, coverUserIds } = data;

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
      days: Number(days),
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

    const enriched = await LeaveController.enrichLeaveRequest(row, userMap);

    return { enriched, orderedApproverIds, userMap, row: row.toJSON() };
  }

  static async getLeaveRequest(requestId: number) {
    return LeaveRequest.findByPk(requestId);
  }

  static async respondToCover(requestId: number, userId: number, decision: "agreed" | "declined", note?: string) {
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
      data: await LeaveController.enrichLeaveRequest(updated, userMap),
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
      return { data: await LeaveController.enrichLeaveRequest(updatedRows[0], userMap) };
    }

    if (status === "approved" || status === "rejected") {
      const ROLE_LEVEL: Record<string, number> = { super_admin: 4, admin: 3, manager: 2, employee: 1 };
      if ((ROLE_LEVEL[role] ?? 1) < 2) return { error: "Insufficient permissions", status: 403 };
      if (row.status !== "pending") return { error: "Only pending requests can be reviewed", status: 400 };

      const approverRows = await LeaveApprover.findAll({
        where: { leaveRequestId: row.id, status: "pending" },
        order: [["orderIndex", "ASC"]],
        limit: 1,
      });

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
          data: await LeaveController.enrichLeaveRequest(updatedRows[0], userMap),
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
        data: await LeaveController.enrichLeaveRequest(updatedRows[0], userMap),
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
