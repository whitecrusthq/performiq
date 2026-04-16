import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AttendanceController from "../../controllers/AttendanceController.js";

export class GetTodayStatusAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const log = await AttendanceController.getTodayStatus(req.user!.id);
      res.json(log);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch today status" });
    }
  }
}
