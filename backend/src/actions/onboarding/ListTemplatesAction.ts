import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import OnboardingController from "../../controllers/OnboardingController.js";

export class ListTemplatesAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result = await OnboardingController.listTemplates();
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
