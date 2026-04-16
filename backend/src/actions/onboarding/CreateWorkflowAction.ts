import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import OnboardingController from "../../controllers/OnboardingController.js";

export class CreateWorkflowAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { employeeId, type, title } = req.body;
      if (!employeeId || !type || !title) {
        res.status(400).json({ error: "employeeId, type, and title are required" }); return;
      }
      const result = await OnboardingController.createWorkflow({ ...req.body, startedById: req.user!.id });
      res.status(201).json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
