import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import CriteriaController from "../../controllers/CriteriaController.js";

export class CreateCriterionAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { name, description, category, weight, type, targetValue, unit, targetPeriod } = req.body;
      const criterion = await CriteriaController.create({ name, description, category, weight, type, targetValue, unit, targetPeriod });
      res.status(201).json(criterion);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
