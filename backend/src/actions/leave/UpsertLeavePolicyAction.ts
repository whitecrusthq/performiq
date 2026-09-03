import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import LeaveController from "../../controllers/LeaveController.js";

export class UpsertLeavePolicyAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { leaveType, daysAllocated, cycleStartMonth, cycleStartDay, cycleEndMonth, cycleEndDay, prorationMode } = req.body;
      if (!leaveType || daysAllocated === undefined) {
        res.status(400).json({ error: "leaveType and daysAllocated are required" }); return;
      }
      const result = await LeaveController.upsertPolicy({ leaveType, daysAllocated, cycleStartMonth, cycleStartDay, cycleEndMonth, cycleEndDay, prorationMode });
      if ("error" in result) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
