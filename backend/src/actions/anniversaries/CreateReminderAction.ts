import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AnniversaryController from "../../controllers/AnniversaryController.js";

export class CreateReminderAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { title, reminderDate } = req.body;
      if (!title || !reminderDate) {
        return res.status(400).json({ error: "Title and date are required" });
      }
      const result = await AnniversaryController.createReminder(req.body, req.user!.id);
      res.status(201).json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
