import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import OnboardingController from "../../controllers/OnboardingController.js";

export class ListDocumentsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const workflowId = parseInt(req.params.id);
      const docs = await OnboardingController.listDocuments(workflowId);
      res.json(docs);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
