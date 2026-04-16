import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import GoalController from "../../controllers/GoalController.js";

export class UpdateGoalAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { title, description, status, dueDate, progress } = req.body;
      const goal = await GoalController.update(Number(req.params.id), { title, description, status, dueDate, progress });
      if (!goal) { res.status(404).json({ error: "Goal not found" }); return; }
      res.json(goal);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
