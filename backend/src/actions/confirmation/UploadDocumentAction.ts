import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import ConfirmationController from "../../controllers/ConfirmationController.js";

export class UploadDocumentAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { documentPath, documentName } = req.body;
      if (!documentPath) { res.status(400).json({ error: "documentPath is required" }); return; }
      const result = await ConfirmationController.uploadDocument(id, documentPath, documentName);
      if ("error" in result) { res.status(result.status!).json({ error: result.error }); return; }
      res.json(result.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
