import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import LeaveController from "../../controllers/LeaveController.js";
import { User, LeaveApprover } from "../../models/index.js";

export class GetLeaveRequestAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const row = await LeaveController.getLeaveRequest(Number(req.params.id));
      if (!row) { res.status(404).json({ error: "Not found" }); return; }
      const { role, id, customRoleName } = req.user!;
      // Department-based access: admin/super_admin (null) see any request; everyone
      // else may only view requests from employees in their visible scope, or any
      // request where they are personally an approver or cover officer.
      const visibleIds = await LeaveController.getVisibleEmployeeIds(id, role, customRoleName);
      if (visibleIds !== null) {
        const visibleSet = new Set(visibleIds);
        const approvers = await LeaveApprover.findAll({ where: { leaveRequestId: row.id } });
        const isInChain = approvers.some(a => a.approverId === id);
        const isCover = row.coverUserId1 === id || row.coverUserId2 === id;
        if (!visibleSet.has(row.employeeId) && !isInChain && !isCover) {
          res.status(403).json({ error: "Forbidden" }); return;
        }
      }
      const userMap: Record<number, any> = {};
      const lookupIds = [
        row.employeeId,
        ...(row.reviewerId ? [row.reviewerId] : []),
        ...(row.coverUserId1 ? [row.coverUserId1] : []),
        ...(row.coverUserId2 ? [row.coverUserId2] : []),
      ];
      const users = await User.findAll({
        where: { id: lookupIds },
        attributes: ["id", "name", "email", "department", "jobTitle"],
      });
      users.forEach(u => { userMap[u.id] = u.toJSON(); });
      res.json(await LeaveController.enrichLeaveRequest(row, userMap));
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  }
}
