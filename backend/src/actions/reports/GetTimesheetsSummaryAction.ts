import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import ReportController from "../../controllers/ReportController.js";

export class GetTimesheetsSummaryAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { from, to, status, userId } = req.query as Record<string, string | undefined>;
      const data = await ReportController.getTimesheetsSummary({ from, to, status, userId });
      res.json(data);
    } catch (err) {
      console.error("GET /reports/timesheets-summary error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
