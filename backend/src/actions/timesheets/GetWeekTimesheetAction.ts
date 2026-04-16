import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import TimesheetController from "../../controllers/TimesheetController.js";

export class GetWeekTimesheetAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const dateParam = typeof req.query.date === "string" ? req.query.date : null;
      const result = await TimesheetController.getWeekTimesheet(req.user!.id, dateParam);
      if ("error" in result && !("data" in result)) { res.status(result.status!).json({ error: result.error }); return; }
      res.json(result.data);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch timesheet for week" });
    }
  }
}
