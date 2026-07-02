import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AttendanceScheduleController from "../../controllers/AttendanceScheduleController.js";

export class UpdateScheduleSettingsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      res.json(await AttendanceScheduleController.updateSettings(req.body ?? {}));
    } catch (err) {
      console.error("PUT /attendance/schedule-settings error:", err);
      res.status(500).json({ error: "Failed to update attendance schedule settings" });
    }
  }
}
