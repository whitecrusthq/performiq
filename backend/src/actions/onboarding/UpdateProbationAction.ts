import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import OnboardingController from "../../controllers/OnboardingController.js";

export class UpdateProbationAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const userId = parseInt(req.params.userId);
      const { action, extendDays } = req.body;
      if (!["confirm", "extend", "fail"].includes(action)) {
        res.status(400).json({ error: "action must be confirm, extend, or fail" }); return;
      }
      const result = await OnboardingController.updateProbation(userId, action, extendDays ? parseInt(extendDays) : undefined);
      if ("error" in result) { res.status(result.status!).json({ error: result.error }); return; }
      res.json(result.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
