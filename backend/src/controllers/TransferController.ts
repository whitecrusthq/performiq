import { Op } from "sequelize";
import { TransferRequest, TransferApprover, User, Site } from "../models/index.js";
import sequelize from "../db/sequelize.js";

export default class TransferController {
  static async getApproversForRequest(transferRequestId: number) {
    const rows = await TransferApprover.findAll({
      where: { transferRequestId },
      order: [["orderIndex", "ASC"]],
    });
    if (rows.length === 0) return [];
    const approverUsers = await User.findAll({
      where: { id: { [Op.in]: rows.map(r => r.approverId) } },
      attributes: ["id", "name", "email", "department", "jobTitle", "role"],
    });
    const userMap = Object.fromEntries(approverUsers.map(u => [u.id, { id: u.id, name: u.name, email: u.email, department: u.department, jobTitle: u.jobTitle, role: u.role }]));
    return rows.map(row => ({
      id: row.approverId,
      rowId: row.id,
      orderIndex: row.orderIndex,
      status: row.status,
      note: row.note,
      reviewedAt: row.reviewedAt,
      approver: userMap[row.approverId] ?? null,
    }));
  }

  static async enrichTransfer(t: TransferRequest) {
    const userIds = [t.employeeId, t.requestedById, ...(t.approvedById ? [t.approvedById] : [])];
    const users = await User.findAll({
      where: { id: { [Op.in]: userIds } },
      attributes: ["id", "name", "email", "department", "jobTitle", "managerId", "firstName", "middleName", "surname", "staffId"],
    });
    const userMap: Record<number, any> = {};
    users.forEach(u => { userMap[u.id] = u.get({ plain: true }); });

    const siteIds = [t.toSiteId, ...(t.fromSiteId ? [t.fromSiteId] : [])];
    const sites = await Site.findAll({ where: { id: { [Op.in]: siteIds } } });
    const siteMap: Record<number, any> = {};
    sites.forEach(s => { siteMap[s.id] = s.get({ plain: true }); });

    const approvers = await TransferController.getApproversForRequest(t.id);
    const currentApprover = t.status === "pending" ? (approvers.find(a => a.status === "pending") ?? null) : null;

    return {
      ...t.get({ plain: true }),
      employee: userMap[t.employeeId] ?? null,
      requestedBy: userMap[t.requestedById] ?? null,
      approvedBy: t.approvedById ? (userMap[t.approvedById] ?? null) : null,
      fromSite: t.fromSiteId ? (siteMap[t.fromSiteId] ?? null) : null,
      toSite: siteMap[t.toSiteId] ?? null,
      approvers,
      currentApproverId: currentApprover?.id ?? null,
    };
  }

  static async listTransfers(user: { id: number; role: string }) {
    let rows = await TransferRequest.findAll({ order: [["createdAt", "DESC"]] });

    if (user.role !== "admin" && user.role !== "super_admin") {
      const team = await User.findAll({ where: { managerId: user.id }, attributes: ["id"] });
      const teamIds = new Set([user.id, ...team.map(t => t.id)]);
      // Carve-out: always see transfers where you are personally an approver.
      const approverRows = await TransferApprover.findAll({
        where: { approverId: user.id },
        attributes: ["transferRequestId"],
      });
      const approverRequestIds = new Set(approverRows.map(a => a.transferRequestId));
      rows = rows.filter(r =>
        teamIds.has(r.employeeId) ||
        r.requestedById === user.id ||
        approverRequestIds.has(r.id)
      );
    }

    return Promise.all(rows.map(r => TransferController.enrichTransfer(r)));
  }

  static async getTransfer(id: number, user: { id: number; role: string }) {
    const row = await TransferRequest.findByPk(id);
    if (!row) return null;

    const isAdminRole = user.role === "admin" || user.role === "super_admin";
    if (!isAdminRole) {
      const isInvolved = row.employeeId === user.id || row.requestedById === user.id;
      let allowed = isInvolved;
      if (!allowed) {
        const employee = await User.findOne({ where: { id: row.employeeId }, attributes: ["managerId"] });
        allowed = employee?.managerId === user.id;
      }
      if (!allowed) {
        const approverRow = await TransferApprover.findOne({
          where: { transferRequestId: row.id, approverId: user.id },
        });
        allowed = !!approverRow;
      }
      if (!allowed) return { error: "Forbidden", status: 403 } as const;
    }

    return TransferController.enrichTransfer(row);
  }

  static async createTransfer(data: any, requestedById: number) {
    const { employeeId, fromSiteId, toSiteId, fromDepartment, toDepartment, reason, effectiveDate, endDate, approverIds } = data;

    // Ordered approval chain: use the provided approvers, or fall back to the
    // employee's direct manager (legacy behavior).
    let orderedApproverIds: number[] = Array.isArray(approverIds)
      ? [...new Set(approverIds.map(Number).filter(Boolean))]
      : [];

    if (orderedApproverIds.length > 0) {
      const approverUsers = await User.findAll({
        where: { id: { [Op.in]: orderedApproverIds } },
        attributes: ["id", "role"],
      });
      const found = new Map(approverUsers.map(u => [u.id, u.role]));
      for (const aid of orderedApproverIds) {
        const role = found.get(aid);
        if (!role) return { error: `Approver ${aid} not found`, status: 400 };
        if (!["manager", "admin", "super_admin"].includes(role)) {
          return { error: "Approvers must be managers or admins", status: 400 };
        }
      }
    } else {
      const emp = await User.findOne({ where: { id: Number(employeeId) }, attributes: ["managerId"] });
      if (emp?.managerId) orderedApproverIds = [emp.managerId];
    }

    const row = await sequelize.transaction(async (tx) => {
      const created = await TransferRequest.create({
        employeeId: Number(employeeId),
        fromSiteId: fromSiteId ? Number(fromSiteId) : null,
        toSiteId: Number(toSiteId),
        fromDepartment: fromDepartment || null,
        toDepartment: toDepartment || null,
        reason,
        effectiveDate,
        endDate: endDate || null,
        requestedById,
        status: "pending",
      }, { transaction: tx });

      if (orderedApproverIds.length > 0) {
        await TransferApprover.bulkCreate(
          orderedApproverIds.map((aid, idx) => ({
            transferRequestId: created.id,
            approverId: aid,
            orderIndex: idx,
            status: "pending",
          })),
          { transaction: tx }
        );
      }
      return created;
    });

    return { data: await TransferController.enrichTransfer(row) };
  }

  static async updateTransfer(id: number, body: any, user: { id: number; role: string }) {
    const row = await TransferRequest.findByPk(id);
    if (!row) return { error: "Not found", status: 404 };

    const { status, approvalNotes } = body;
    const isAdminRole = user.role === "admin" || user.role === "super_admin";

    if (status === "approved" || status === "rejected") {
      // Whole review runs in one transaction with a row lock on the transfer,
      // so two concurrent reviewers (e.g. current approver + admin) can't both
      // act on the same step or produce conflicting final outcomes.
      const outcome: { error: string; status: number } | { ok: true } = await sequelize.transaction(async (tx): Promise<{ error: string; status: number } | { ok: true }> => {
        const locked = await TransferRequest.findByPk(id, { transaction: tx, lock: tx.LOCK.UPDATE });
        if (!locked) return { error: "Not found", status: 404 } as const;
        if (locked.status !== "pending") return { error: "Only pending transfers can be reviewed", status: 400 } as const;

        const pendingSteps = await TransferApprover.findAll({
          where: { transferRequestId: locked.id, status: "pending" },
          order: [["orderIndex", "ASC"]],
          transaction: tx,
          lock: tx.LOCK.UPDATE,
        });

        if (pendingSteps.length > 0) {
          // Sequential approval chain: only the current-step approver (or an admin) may act.
          const currentStep = pendingSteps[0];
          const isCurrentApprover = currentStep.approverId === user.id;
          if (!isAdminRole && !isCurrentApprover) {
            return { error: "You are not the current approver for this transfer", status: 403 } as const;
          }

          // Compare-and-set: only touch the step if it is still pending.
          const [stepUpdated] = await TransferApprover.update(
            { status, note: approvalNotes || null, reviewedAt: new Date() },
            { where: { id: currentStep.id, status: "pending" }, transaction: tx }
          );
          if (stepUpdated === 0) {
            return { error: "This step has already been reviewed", status: 409 } as const;
          }

          if (status === "rejected") {
            await TransferRequest.update({
              status: "rejected",
              approvedById: user.id,
              approvalNotes: approvalNotes || null,
              approvedAt: new Date(),
              updatedAt: new Date(),
            }, { where: { id: locked.id, status: "pending" }, transaction: tx });
            return { ok: true } as const;
          }

          const remaining = pendingSteps.length - 1;
          if (remaining > 0) {
            // Not final yet: transfer stays pending, next approver is up.
            await TransferRequest.update({ updatedAt: new Date() }, { where: { id: locked.id }, transaction: tx });
            return { ok: true } as const;
          }

          // Final approval: complete the transfer and apply the change atomically.
          const [reqUpdated] = await TransferRequest.update({
            status: "approved",
            approvedById: user.id,
            approvalNotes: approvalNotes || null,
            approvedAt: new Date(),
            updatedAt: new Date(),
          }, { where: { id: locked.id, status: "pending" }, transaction: tx });
          if (reqUpdated === 0) {
            return { error: "Transfer was already finalized", status: 409 } as const;
          }

          const updateData: any = { siteId: locked.toSiteId };
          if (locked.toDepartment) updateData.department = locked.toDepartment;
          await User.update(updateData, { where: { id: locked.employeeId }, transaction: tx });
          return { ok: true } as const;
        }

        // Legacy transfers with no approval chain: direct manager or admin decides.
        if (!isAdminRole) {
          const employee = await User.findOne({ where: { id: locked.employeeId }, attributes: ["managerId"], transaction: tx });
          if (!employee || employee.managerId !== user.id) {
            return { error: "Only the employee's direct manager or an admin can approve/reject transfers", status: 403 } as const;
          }
        }

        const [reqUpdated] = await TransferRequest.update({
          status,
          approvedById: user.id,
          approvalNotes: approvalNotes || null,
          approvedAt: new Date(),
          updatedAt: new Date(),
        }, { where: { id: locked.id, status: "pending" }, transaction: tx });
        if (reqUpdated === 0) {
          return { error: "Transfer was already finalized", status: 409 } as const;
        }

        if (status === "approved") {
          const updateData: any = { siteId: locked.toSiteId };
          if (locked.toDepartment) updateData.department = locked.toDepartment;
          await User.update(updateData, { where: { id: locked.employeeId }, transaction: tx });
        }
        return { ok: true } as const;
      });

      if ("error" in outcome) return outcome;
      const fresh = await TransferRequest.findByPk(id);
      return { data: await TransferController.enrichTransfer(fresh!) };
    }

    if (status === "cancelled") {
      if (row.status !== "pending") return { error: "Only pending transfers can be cancelled", status: 400 };
      if (!isAdminRole && row.requestedById !== user.id) {
        return { error: "Only the requester or an admin can cancel a transfer", status: 403 };
      }
      const [, rows] = await TransferRequest.update({
        status: "cancelled",
        updatedAt: new Date(),
      }, { where: { id: row.id }, returning: true });
      return { data: await TransferController.enrichTransfer(rows[0]) };
    }

    return { error: "Invalid status", status: 400 };
  }

  static async getEmployeeTransfers(employeeId: number, user: { id: number; role: string }) {
    if (user.role === "employee" && user.id !== employeeId) {
      return { error: "You can only view your own transfer history", status: 403 };
    }
    if (user.role === "manager") {
      const team = await User.findAll({ where: { managerId: user.id }, attributes: ["id"] });
      const teamIds = new Set([user.id, ...team.map(t => t.id)]);
      if (!teamIds.has(employeeId)) {
        return { error: "You can only view transfer history for your team", status: 403 };
      }
    }

    const rows = await TransferRequest.findAll({
      where: { employeeId },
      order: [["createdAt", "DESC"]],
    });
    return { data: await Promise.all(rows.map(r => TransferController.enrichTransfer(r))) };
  }

  static async deleteTransfer(id: number) {
    await TransferRequest.destroy({ where: { id } });
  }
}
