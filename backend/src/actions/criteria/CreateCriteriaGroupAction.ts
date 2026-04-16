import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import CriteriaController from "../../controllers/CriteriaController.js";

export class CreateCriteriaGroupAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { name, description, criteriaIds } = req.body;
      const group = await CriteriaController.createGroup({ name, description, criteriaIds });
      res.status(201).json(group);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
