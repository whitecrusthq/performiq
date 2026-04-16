import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import SecurityController from "../../controllers/SecurityController.js";

export class UpdateSecuritySettingsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const updated = await SecurityController.updateSettings(req.body);
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
