import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import CustomRoleController from "../../controllers/CustomRoleController.js";

export class DeleteCustomRoleAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      await CustomRoleController.delete(Number(req.params.id));
      res.json({ message: "Role deleted" });
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
