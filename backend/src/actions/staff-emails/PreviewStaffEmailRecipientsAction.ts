import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import StaffEmailController from "../../controllers/StaffEmailController.js";

export class PreviewStaffEmailRecipientsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      res.json(await StaffEmailController.preview(req.body?.filters));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
