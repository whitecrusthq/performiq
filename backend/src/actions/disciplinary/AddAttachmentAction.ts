import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import DisciplinaryController from "../../controllers/DisciplinaryController.js";

export class AddAttachmentAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const recordId = Number(req.params.id);
      const { fileName, fileType, objectPath } = req.body;
      if (!fileName || !objectPath) return res.status(400).json({ error: "fileName and objectPath are required" });
      const result = await DisciplinaryController.addAttachment(recordId, {
        fileName, fileType, objectPath, uploadedById: req.user!.id,
      });
      res.status(201).json(result);
    } catch (err) {
      console.error("POST attachment error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
