import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AttendanceController from "../../controllers/AttendanceController.js";

export class LocationPingAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { lat, lng, recordedAt } = req.body;
      if (lat == null || lng == null) { res.status(400).json({ error: "lat and lng are required" }); return; }
      const { id: userId } = req.user as { id: number; role: string; email: string };
      const result = await AttendanceController.locationPing(userId, { lat, lng, recordedAt });
      if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
      res.json(result.data);
    } catch (err) {
      res.status(500).json({ error: "Failed to save location ping" });
    }
  }
}
