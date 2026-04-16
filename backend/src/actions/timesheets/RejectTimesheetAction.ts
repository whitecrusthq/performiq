import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import TimesheetController from "../../controllers/TimesheetController.js";

export class RejectTimesheetAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { id: rejectorId, role } = req.user as { id: number; role: string; email: string };
      const { notes } = req.body;
      const result = await TimesheetController.rejectTimesheet(parseInt(req.params.id as string), rejectorId, role, notes);
      if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
      res.json(result.data);
    } catch (err) {
      res.status(500).json({ error: "Failed to reject" });
    }
  }
}
