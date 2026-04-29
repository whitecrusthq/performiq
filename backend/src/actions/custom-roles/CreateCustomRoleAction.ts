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
      const result: any = await CustomRoleController.create(req.body);
      if (result?.error) { res.status(result.status ?? 400).json({ error: result.error }); return; }
      res.status(201).json(result);
    } catch (err: any) {
      if (err.original?.code === "23505") res.status(409).json({ error: "Role name already exists" });
      else res.status(500).json({ error: "Server error" });
    }
  }
}
