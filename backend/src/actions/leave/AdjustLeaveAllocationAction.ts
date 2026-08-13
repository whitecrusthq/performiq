import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import LeaveController from "../../controllers/LeaveController.js";

export class AdjustLeaveAllocationAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const employeeId = Number(req.body?.employeeId);
      const leaveType = String(req.body?.leaveType ?? "");
      const allocated = Number(req.body?.allocated);
      if (!Number.isInteger(employeeId) || employeeId <= 0 || !leaveType) {
        res.status(400).json({ error: "employeeId and leaveType are required" }); return;
      }
      if (!Number.isFinite(allocated) || allocated < 0 || allocated > 366) {
        res.status(400).json({ error: "allocated must be between 0 and 366" }); return;
      }
      const result = await LeaveController.adjustAllocation(employeeId, leaveType, allocated);
      if ("error" in result) { res.status(result.status ?? 400).json({ error: result.error }); return; }
      res.json(result.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
