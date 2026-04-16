import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import TimesheetController from "../../controllers/TimesheetController.js";

export class ListTimesheetApproversAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const managers = await TimesheetController.listApprovers(req.user!.id);
      res.json(managers);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch approvers" });
    }
  }
}
