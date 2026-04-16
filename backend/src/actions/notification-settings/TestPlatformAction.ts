import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import NotificationSettingsController from "../../controllers/NotificationSettingsController.js";

export class TestPlatformAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { platform } = req.params;
      const result = await NotificationSettingsController.testPlatform(platform);
      if ("error" in result) { res.status(result.status!).json({ error: result.error }); return; }
      res.json(result.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
