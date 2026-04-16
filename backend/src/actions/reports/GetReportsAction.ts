import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import ReportController from "../../controllers/ReportController.js";

export class GetReportsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const deptFilter = req.query.department as string | undefined;
      const data = await ReportController.getReports(deptFilter);
      res.json(data);
    } catch (err) {
      console.error("GET /reports error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
