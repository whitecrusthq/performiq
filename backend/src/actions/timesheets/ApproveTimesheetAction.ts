import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import TimesheetController from "../../controllers/TimesheetController.js";

export class ApproveTimesheetAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { id: approverId, role } = req.user as { id: number; role: string; email: string };
      const result = await TimesheetController.approveTimesheet(parseInt(req.params.id as string), approverId, role);
      if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
      res.json(result.data);
    } catch (err) {
      res.status(500).json({ error: "Failed to approve" });
    }
  }
}
