import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import CriteriaController from "../../controllers/CriteriaController.js";

export class UpdateCriterionAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { name, description, category, weight, type, targetValue, unit, targetPeriod } = req.body;
      const criterion = await CriteriaController.update(Number(req.params.id), { name, description, category, weight, type, targetValue, unit, targetPeriod });
      if (!criterion) { res.status(404).json({ error: "Criterion not found" }); return; }
      res.json(criterion);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
