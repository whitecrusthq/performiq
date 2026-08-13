import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import LeaveController from "../../controllers/LeaveController.js";

export class GetHrApproverAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      res.json({ hrApprover: await LeaveController.getHrLeaveApprover() });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}

export class SetHrApproverAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const raw = req.body?.userId;
      const userId = raw === null || raw === "" || raw === undefined ? null : Number(raw);
      if (userId !== null && (!Number.isInteger(userId) || userId <= 0)) {
        res.status(400).json({ error: "Invalid userId" }); return;
      }
      const result = await LeaveController.setHrLeaveApprover(userId);
      if ("error" in result) { res.status(result.status ?? 400).json({ error: result.error }); return; }
      res.json({ hrApprover: await LeaveController.getHrLeaveApprover() });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
