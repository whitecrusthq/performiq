import { Request, Response } from "express";
import StorageController from "../../controllers/StorageController.js";

export class ProxyUploadAction {
  static async handle(req: Request, res: Response) {
    try {
      const raw = req.params.token;
      const token = Array.isArray(raw) ? raw[0] : String(raw ?? "");
      await StorageController.proxyUpload(token, req, res);
    } catch (err: any) {
      console.error("Storage proxy upload error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err?.message || "Upload failed" });
      }
    }
  }
}
