import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import TimesheetController from "../../controllers/TimesheetController.js";

export class ListTimesheetsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { role, id: userId } = req.user!;
      const result = await TimesheetController.listTimesheets(userId, role);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch timesheets" });
    }
  }
}
