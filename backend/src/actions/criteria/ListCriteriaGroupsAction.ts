import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import CriteriaController from "../../controllers/CriteriaController.js";

export class ListCriteriaGroupsAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      const groups = await CriteriaController.getAllGroups();
      res.json(groups);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
