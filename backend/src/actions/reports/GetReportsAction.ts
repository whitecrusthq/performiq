import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import ReportController from "../../controllers/ReportController.js";

export class GetReportsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const data = await ReportController.getReports({
        department: req.query.department as string | undefined,
        siteId: req.query.siteId as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
      });
      res.json(data);
    } catch (err) {
      console.error("GET /reports error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
