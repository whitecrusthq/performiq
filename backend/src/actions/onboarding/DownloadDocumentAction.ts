import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import OnboardingController from "../../controllers/OnboardingController.js";

export class DownloadDocumentAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const docId = parseInt(req.params.docId);
      const result = await OnboardingController.downloadDocument(docId);
      if (!result) { res.status(404).json({ error: "Not found" }); return; }
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
