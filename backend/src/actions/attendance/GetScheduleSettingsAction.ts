import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AttendanceScheduleController from "../../controllers/AttendanceScheduleController.js";

export class GetScheduleSettingsAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      res.json(await AttendanceScheduleController.getSettingsPayload());
    } catch (err) {
      console.error("GET /attendance/schedule-settings error:", err);
      res.status(500).json({ error: "Failed to load attendance schedule settings" });
    }
  }
}
