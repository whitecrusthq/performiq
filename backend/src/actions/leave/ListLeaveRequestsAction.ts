import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import LeaveController from "../../controllers/LeaveController.js";

export class ListLeaveRequestsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { role, id } = req.user!;
      const department = req.query.department as string | undefined;
      const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
      const enriched = await LeaveController.listLeaveRequests(id, role, department, employeeId);
      res.json(enriched);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
