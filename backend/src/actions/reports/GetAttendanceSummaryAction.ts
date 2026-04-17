import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import ReportController from "../../controllers/ReportController.js";

export class GetAttendanceSummaryAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { from, to, userId, siteId, department } = req.query as Record<string, string | undefined>;
      const data = await ReportController.getAttendanceSummary({ from, to, userId, siteId, department });
      res.json(data);
    } catch (err) {
      console.error("GET /reports/attendance-summary error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
