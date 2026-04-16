import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AnniversaryController from "../../controllers/AnniversaryController.js";

export class DeleteReminderAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const found = await AnniversaryController.deleteReminder(Number(req.params.id));
      if (!found) return res.status(404).json({ error: "Not found" });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
