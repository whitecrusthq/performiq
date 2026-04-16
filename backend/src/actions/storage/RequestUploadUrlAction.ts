import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import StorageController from "../../controllers/StorageController.js";

export class RequestUploadUrlAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result = await StorageController.requestUploadUrl();
      res.json(result);
    } catch (err: any) {
      console.error("Storage upload URL error:", err);
      res.status(500).json({ error: err.message || "Failed to generate upload URL" });
    }
  }
}
