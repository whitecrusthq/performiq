import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import CustomRoleController from "../../controllers/CustomRoleController.js";

export class UpdateCustomRoleAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const role = await CustomRoleController.update(Number(req.params.id), req.body);
      if (!role) { res.status(404).json({ error: "Not found" }); return; }
      res.json(role);
    } catch (err: any) {
      if (err.original?.code === "23505") res.status(409).json({ error: "Role name already exists" });
      else res.status(500).json({ error: "Server error" });
    }
  }
}
