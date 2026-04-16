import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import NotificationSettingsController from "../../controllers/NotificationSettingsController.js";

export class GetPlatformsAction {
  static async handle(_req: AuthRequest, res: Response) {
    res.json(await NotificationSettingsController.getPlatforms());
  }
}
