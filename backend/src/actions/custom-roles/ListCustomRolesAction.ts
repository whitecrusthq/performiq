import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import CustomRoleController from "../../controllers/CustomRoleController.js";

export class ListCustomRolesAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      const roles = await CustomRoleController.getAll();
      res.json(roles);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
