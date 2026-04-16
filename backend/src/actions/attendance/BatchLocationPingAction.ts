import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AttendanceController from "../../controllers/AttendanceController.js";

export class BatchLocationPingAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { pings } = req.body as { pings: Array<{ lat: number; lng: number; recordedAt: string }> };
      if (!Array.isArray(pings) || pings.length === 0) { res.status(400).json({ error: "pings array required" }); return; }
      const result = await AttendanceController.batchLocationPing(req.user!.id, pings);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Failed to save batch pings" });
    }
  }
}
