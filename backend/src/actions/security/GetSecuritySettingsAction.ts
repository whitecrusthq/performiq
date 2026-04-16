import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import SecurityController from "../../controllers/SecurityController.js";

export class GetSecuritySettingsAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      const settings = await SecurityController.getSettings();
      res.json(settings);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
