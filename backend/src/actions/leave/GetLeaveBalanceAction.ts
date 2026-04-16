import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import LeaveController from "../../controllers/LeaveController.js";

export class GetLeaveBalanceAction {
  static async handle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await LeaveController.getLeaveBalance(req.user!.id);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
