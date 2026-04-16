import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import CustomRoleController from "../../controllers/CustomRoleController.js";

export class CreateCustomRoleAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { name, permissionLevel } = req.body;
      if (!name || !permissionLevel) {
        res.status(400).json({ error: "name and permissionLevel are required" }); return;
      }
      const role = await CustomRoleController.create(req.body);
      res.status(201).json(role);
    } catch (err: any) {
      if (err.original?.code === "23505") res.status(409).json({ error: "Role name already exists" });
      else res.status(500).json({ error: "Server error" });
    }
  }
}
