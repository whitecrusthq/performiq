import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import TimesheetController from "../../controllers/TimesheetController.js";

export class UpsertTimesheetEntryAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { date, minutes, notes } = req.body;
      const { id: userId } = req.user as { id: number; role: string; email: string };
      const result = await TimesheetController.upsertEntry(parseInt(req.params.id as string), userId, { date, minutes, notes });
      if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
      res.json(result.data);
    } catch (err) {
      res.status(500).json({ error: "Failed to save entry" });
    }
  }
}
