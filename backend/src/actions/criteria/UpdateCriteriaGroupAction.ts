import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import CriteriaController from "../../controllers/CriteriaController.js";

export class UpdateCriteriaGroupAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { name, description, criteriaIds } = req.body;
      const group = await CriteriaController.updateGroup(Number(req.params.id), { name, description, criteriaIds });
      if (!group) { res.status(404).json({ error: "Group not found" }); return; }
      res.json(group);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
