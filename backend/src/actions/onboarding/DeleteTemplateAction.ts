import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import OnboardingController from "../../controllers/OnboardingController.js";

export class DeleteTemplateAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      await OnboardingController.deleteTemplate(id);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
