import { Op } from "sequelize";
import { TransferRequest, User, Site } from "../models/index.js";

export default class TransferController {
  static async enrichTransfer(t: TransferRequest) {
    const userIds = [t.employeeId, t.requestedById, ...(t.approvedById ? [t.approvedById] : [])];
    const users = await User.findAll({
      where: { id: { [Op.in]: userIds } },
      attributes: ["id", "name", "email", "department", "jobTitle", "managerId"],
    });
    const userMap: Record<number, any> = {};
    users.forEach(u => { userMap[u.id] = u.get({ plain: true }); });

    const siteIds = [t.toSiteId, ...(t.fromSiteId ? [t.fromSiteId] : [])];
    const sites = await Site.findAll({ where: { id: { [Op.in]: siteIds } } });
    const siteMap: Record<number, any> = {};
    sites.forEach(s => { siteMap[s.id] = s.get({ plain: true }); });

    return {
      ...t.get({ plain: true }),
      employee: userMap[t.employeeId] ?? null,
      requestedBy: userMap[t.requestedById] ?? null,
      approvedBy: t.approvedById ? (userMap[t.approvedById] ?? null) : null,
      fromSite: t.fromSiteId ? (siteMap[t.fromSiteId] ?? null) : null,
      toSite: siteMap[t.toSiteId] ?? null,
    };
  }

  static async listTransfers(user: { id: number; role: string }) {
    let rows = await TransferRequest.findAll({ order: [["createdAt", "DESC"]] });

    if (user.role === "manager") {
      const team = await User.findAll({ where: { managerId: user.id }, attributes: ["id"] });
      const teamIds = new Set([user.id, ...team.map(t => t.id)]);
      rows = rows.filter(r => teamIds.has(r.employeeId) || r.requestedById === user.id);
    }

    return Promise.all(rows.map(r => TransferController.enrichTransfer(r)));
  }

  static async getTransfer(id: number) {
    const row = await TransferRequest.findByPk(id);
    if (!row) return null;
    return TransferController.enrichTransfer(row);
  }

  static async createTransfer(data: any, requestedById: number) {
    const { employeeId, fromSiteId, toSiteId, fromDepartment, toDepartment, reason, effectiveDate, endDate } = data;
    const row = await TransferRequest.create({
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
    });
    return TransferController.enrichTransfer(row);
  }

  static async updateTransfer(id: number, body: any, user: { id: number; role: string }) {
    const row = await TransferRequest.findByPk(id);
    if (!row) return { error: "Not found", status: 404 };

    const { status, approvalNotes } = body;
    const isAdminRole = user.role === "admin" || user.role === "super_admin";

    if (status === "approved" || status === "rejected") {
      if (row.status !== "pending") return { error: "Only pending transfers can be reviewed", status: 400 };

      if (!isAdminRole) {
        const employee = await User.findOne({ where: { id: row.employeeId }, attributes: ["managerId"] });
        if (!employee || employee.managerId !== user.id) {
          return { error: "Only the employee's direct manager or an admin can approve/reject transfers", status: 403 };
        }
      }

      const [, rows] = await TransferRequest.update({
        status,
        approvedById: user.id,
        approvalNotes: approvalNotes || null,
        approvedAt: new Date(),
        updatedAt: new Date(),
      }, { where: { id: row.id }, returning: true });

      if (status === "approved") {
        const updateData: any = { siteId: row.toSiteId };
        if (row.toDepartment) updateData.department = row.toDepartment;
        await User.update(updateData, { where: { id: row.employeeId } });
      }

      return { data: await TransferController.enrichTransfer(rows[0]) };
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
