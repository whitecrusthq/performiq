import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import LeaveController from "../../controllers/LeaveController.js";

export class DeleteLeavePolicyAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      await LeaveController.deletePolicy(Number(req.params.id));
      res.json({ message: "Deleted" });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  }
}
