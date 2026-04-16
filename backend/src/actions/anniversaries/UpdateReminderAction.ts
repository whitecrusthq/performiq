import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AnniversaryController from "../../controllers/AnniversaryController.js";

export class UpdateReminderAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result = await AnniversaryController.updateReminder(Number(req.params.id), req.body);
      if (!result) return res.status(404).json({ error: "Not found" });
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
