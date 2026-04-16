import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import LeaveController from "../../controllers/LeaveController.js";
import { User, LeaveApprover } from "../../models/index.js";

export class GetLeaveRequestAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const row = await LeaveController.getLeaveRequest(Number(req.params.id));
      if (!row) { res.status(404).json({ error: "Not found" }); return; }
      const { role, id } = req.user!;
      if (role === "employee" && row.employeeId !== id) { res.status(403).json({ error: "Forbidden" }); return; }
      if (role === "manager") {
        const team = await User.findAll({ where: { managerId: id }, attributes: ["id"] });
        const teamIds = new Set(team.map(t => t.id));
        const approvers = await LeaveApprover.findAll({ where: { leaveRequestId: row.id } });
        const isInChain = approvers.some(a => a.approverId === id);
        if (row.employeeId !== id && !teamIds.has(row.employeeId) && !isInChain) {
          res.status(403).json({ error: "Forbidden" }); return;
        }
      }
      const userMap: Record<number, any> = {};
      const users = await User.findAll({ where: { id: row.employeeId } });
      users.forEach(u => { userMap[u.id] = u.toJSON(); });
      res.json(await LeaveController.enrichLeaveRequest(row, userMap));
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  }
}
