import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AttendanceController from "../../controllers/AttendanceController.js";

export class ListAttendanceLogsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { role, id: userId } = req.user!;
      const { startDate, endDate, userId: filterUserId } = req.query as Record<string, string>;
      const result = await AttendanceController.listLogs(userId, role, { startDate, endDate, userId: filterUserId });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch attendance logs" });
    }
  }
}
