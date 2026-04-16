import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AppSettingsController from "../../controllers/AppSettingsController.js";

export class GetAppSettingsAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      const settings = await AppSettingsController.get();
      res.json(settings);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
