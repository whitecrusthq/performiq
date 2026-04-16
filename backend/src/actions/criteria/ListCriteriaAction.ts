import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import CriteriaController from "../../controllers/CriteriaController.js";

export class ListCriteriaAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      const criteria = await CriteriaController.getAll();
      res.json(criteria);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
