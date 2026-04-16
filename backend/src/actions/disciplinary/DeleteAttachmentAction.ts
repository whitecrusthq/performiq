import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import DisciplinaryController from "../../controllers/DisciplinaryController.js";

export class DeleteAttachmentAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const attachmentId = Number(req.params.attachmentId);
      await DisciplinaryController.deleteAttachment(attachmentId);
      res.json({ success: true });
    } catch (err) {
      console.error("DELETE attachment error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
