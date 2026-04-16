import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import OnboardingController from "../../controllers/OnboardingController.js";

export class CreateDocumentAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const workflowId = parseInt(req.params.id);
      const { name, fileData, fileType, notes } = req.body;
      if (!name?.trim()) { res.status(400).json({ error: "Document name required" }); return; }
      const result = await OnboardingController.createDocument(workflowId, {
        name, fileData, fileType, notes,
        uploadedById: req.user!.id,
        uploadedByName: (req.user as any).name || req.user!.email,
      });
      res.status(201).json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
