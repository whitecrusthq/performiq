import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import LeaveController from "../../controllers/LeaveController.js";

export class UpsertLeavePolicyAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { leaveType, daysAllocated, cycleStartMonth, cycleStartDay, cycleEndMonth, cycleEndDay } = req.body;
      if (!leaveType || daysAllocated === undefined) {
        res.status(400).json({ error: "leaveType and daysAllocated are required" }); return;
      }
      const policy = await LeaveController.upsertPolicy({ leaveType, daysAllocated, cycleStartMonth, cycleStartDay, cycleEndMonth, cycleEndDay });
      res.json(policy);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
