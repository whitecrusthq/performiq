import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AttendanceController from "../../controllers/AttendanceController.js";

export class ClockOutAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { notes, lat, lng, faceImage, photoTime } = req.body;
      const { id: userId } = req.user as { id: number; role: string; email: string };
      const result = await AttendanceController.clockOut(userId, { notes, lat, lng, faceImage, photoTime });
      if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
      res.json(result.data);
    } catch (err) {
      res.status(500).json({ error: "Failed to clock out" });
    }
  }
}
