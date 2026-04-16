import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import GoalController from "../../controllers/GoalController.js";

export class ListGoalsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { userId, cycleId } = req.query;
      const goals = await GoalController.getAll({
        userId: userId ? Number(userId) : undefined,
        cycleId: cycleId ? Number(cycleId) : undefined,
        userRole: req.user!.role,
        currentUserId: req.user!.id,
      });
      res.json(goals);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
