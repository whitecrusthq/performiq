import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import DashboardController from "../../controllers/DashboardController.js";

export class GetDashboardAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { id: userId, role } = req.user!;
      const data = await DashboardController.getDashboard(userId, role);
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
