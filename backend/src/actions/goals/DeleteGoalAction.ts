import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import GoalController from "../../controllers/GoalController.js";

export class DeleteGoalAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      await GoalController.delete(Number(req.params.id));
      res.json({ message: "Goal deleted" });
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
