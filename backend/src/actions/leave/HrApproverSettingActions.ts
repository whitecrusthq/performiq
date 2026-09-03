import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import LeaveController from "../../controllers/LeaveController.js";

export class GetHrApproverAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      res.json({ hrApprovers: await LeaveController.listHrLeaveApprovers(req.user ? { id: req.user.id, role: req.user.role } : undefined) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}

export class SetHrApproverAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const raw = req.body?.userIds;
      if (!Array.isArray(raw) || raw.some((v: any) => !Number.isInteger(Number(v)) || Number(v) <= 0)) {
        res.status(400).json({ error: "userIds must be an array of user ids" }); return;
      }
      const assignedRaw = req.body?.assignedUserId;
      const assignedUserId = assignedRaw === null || assignedRaw === undefined || assignedRaw === "" ? null : Number(assignedRaw);
      const result = await LeaveController.setHrLeaveApprovers(raw.map(Number), assignedUserId);
      if ("error" in result) { res.status(result.status ?? 400).json({ error: result.error }); return; }
      res.json({ hrApprovers: await LeaveController.listHrLeaveApprovers(req.user ? { id: req.user.id, role: req.user.role } : undefined) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
