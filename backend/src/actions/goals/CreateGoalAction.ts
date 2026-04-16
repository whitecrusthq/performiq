import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import GoalController from "../../controllers/GoalController.js";

export class CreateGoalAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { title, description, cycleId, userId, dueDate, status } = req.body;
      const targetUserId = (req.user!.role === "employee") ? req.user!.id : (userId ?? req.user!.id);
      const goal = await GoalController.create({ title, description, cycleId, userId: targetUserId, dueDate, status });
      res.status(201).json(goal);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
