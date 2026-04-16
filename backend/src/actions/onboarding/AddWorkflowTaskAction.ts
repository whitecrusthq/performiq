import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import OnboardingController from "../../controllers/OnboardingController.js";

export class AddWorkflowTaskAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const workflowId = parseInt(req.params.id);
      const { title } = req.body;
      if (!title) { res.status(400).json({ error: "title required" }); return; }
      const result = await OnboardingController.addTaskToWorkflow(workflowId, req.body);
      if (!result) { res.status(404).json({ error: "Not found" }); return; }
      res.status(201).json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
