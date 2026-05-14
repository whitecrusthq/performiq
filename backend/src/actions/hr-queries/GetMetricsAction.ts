import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import HrQueryController from "../../controllers/HrQueryController.js";

export class GetMetricsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      if (!HrQueryController.isHR(req.user!)) return res.status(403).json({ error: "Forbidden" });
      const data = await HrQueryController.getMetrics();
      return res.json(data);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to load metrics" });
    }
  }
}
