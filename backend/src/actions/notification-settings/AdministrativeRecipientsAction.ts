import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AdministrativeNotificationController from "../../controllers/AdministrativeNotificationController.js";

export class AdministrativeRecipientsAction {
  static async list(_req: AuthRequest, res: Response) {
    try {
      res.json(await AdministrativeNotificationController.list());
    } catch (err) {
      console.error("GET administrative notification recipients error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const result = await AdministrativeNotificationController.update(req.body?.userIds, req.user!.id);
      if ("error" in result) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json(result.data);
    } catch (err) {
      console.error("PUT administrative notification recipients error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}