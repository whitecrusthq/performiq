import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AppSettingsController from "../../controllers/AppSettingsController.js";

export class UpdateAppSettingsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const updated = await AppSettingsController.update(req.body);
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
