import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import OnboardingController from "../../controllers/OnboardingController.js";

export class CreateTemplateAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { name, type, description, tasks = [] } = req.body;
      if (!name || !type) { res.status(400).json({ error: "name and type required" }); return; }
      const result = await OnboardingController.createTemplate({ name, type, description, tasks, createdById: req.user!.id });
      res.status(201).json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
