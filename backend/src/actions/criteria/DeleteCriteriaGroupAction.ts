import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import CriteriaController from "../../controllers/CriteriaController.js";

export class DeleteCriteriaGroupAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      await CriteriaController.deleteGroup(Number(req.params.id));
      res.json({ message: "Group deleted" });
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
