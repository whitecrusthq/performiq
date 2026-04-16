import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import LeaveController from "../../controllers/LeaveController.js";

export class DeleteLeaveTypeAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result = await LeaveController.deleteLeaveType(Number(req.params.id));
      if ("error" in result && !("success" in result)) { res.status(result.status!).json({ error: result.error }); return; }
      res.json({ message: "Deleted" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
