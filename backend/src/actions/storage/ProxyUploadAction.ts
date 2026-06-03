import { Request, Response } from "express";
import StorageController from "../../controllers/StorageController.js";

export class ProxyUploadAction {
  static async handle(req: Request, res: Response) {
    try {
      const raw = req.params.token;
      const token = Array.isArray(raw) ? raw[0] : String(raw ?? "");
      await StorageController.proxyUpload(token, req, res);
    } catch (err: any) {
      // AWS SDK / S3-compatible errors bury the useful detail in non-message
      // fields. Surface them so a 500 is actually diagnosable (esp. on K8s where
      // pod logs aren't always handy).
      const detail = {
        name: err?.name,
        code: err?.Code || err?.code,
        message: err?.message,
        httpStatus: err?.$metadata?.httpStatusCode,
        requestId: err?.$metadata?.requestId,
      };
      console.error("Storage proxy upload error:", detail, err);
      if (!res.headersSent) {
        const summary = [detail.name, detail.code, detail.message]
          .filter(Boolean)
          .join(": ");
        res.status(500).json({ error: summary || "Upload failed", detail });
      }
    }
  }
}
