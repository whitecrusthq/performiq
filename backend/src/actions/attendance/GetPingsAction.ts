import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AttendanceController from "../../controllers/AttendanceController.js";

export class GetPingsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { id: userId, role } = req.user as { id: number; role: string; email: string };
      const logId = parseInt(req.params.id as string);
      const result = await AttendanceController.getPings(logId, userId, role);
      if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
      res.json(result.data);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch pings" });
    }
  }
}
