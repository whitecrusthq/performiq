import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import CriteriaController from "../../controllers/CriteriaController.js";

export class DeleteCriterionAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      await CriteriaController.delete(Number(req.params.id));
      res.json({ message: "Criterion deleted" });
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
