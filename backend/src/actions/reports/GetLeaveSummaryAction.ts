import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import ReportController from "../../controllers/ReportController.js";

export class GetLeaveSummaryAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const data = await ReportController.getLeaveSummary({
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        status: req.query.status as string | undefined,
        userId: req.query.userId as string | undefined,
        siteId: req.query.siteId as string | undefined,
        department: req.query.department as string | undefined,
        leaveType: req.query.leaveType as string | undefined,
      });
      res.json(data);
    } catch (err) {
      console.error("GET /reports/leave-summary error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
