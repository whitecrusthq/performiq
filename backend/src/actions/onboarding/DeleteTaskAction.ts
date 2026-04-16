import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import OnboardingController from "../../controllers/OnboardingController.js";

export class DeleteTaskAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const result = await OnboardingController.deleteTask(id);
      if ("error" in result) { res.status(404).json({ error: result.error }); return; }
      if ("success" in result) { res.json({ success: true }); return; }
      res.json(result.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
