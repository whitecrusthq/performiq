import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import LeaveController from "../../controllers/LeaveController.js";

export class GetTeamLeaveBalanceAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { id, role } = req.user!;
      const result = await LeaveController.getTeamBalance(id, role);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
