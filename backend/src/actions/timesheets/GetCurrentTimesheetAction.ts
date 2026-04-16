import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import TimesheetController from "../../controllers/TimesheetController.js";

export class GetCurrentTimesheetAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result = await TimesheetController.getCurrentTimesheet(req.user!.id);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch current timesheet" });
    }
  }
}
