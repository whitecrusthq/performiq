import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import OnboardingController from "../../controllers/OnboardingController.js";

export class DeleteDocumentAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const docId = parseInt(req.params.docId);
      await OnboardingController.deleteDocument(docId);
      res.json({ message: "Deleted" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
