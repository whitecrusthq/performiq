import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import NotificationSettingsController from "../../controllers/NotificationSettingsController.js";

export class GetSettingsAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      const result = await NotificationSettingsController.getAll();
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
