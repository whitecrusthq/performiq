import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import OnboardingController from "../../controllers/OnboardingController.js";

export class GetWorkflowAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const result = await OnboardingController.getWorkflow(id, req.user!.role, req.user!.id);
      if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
      res.json(result.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
