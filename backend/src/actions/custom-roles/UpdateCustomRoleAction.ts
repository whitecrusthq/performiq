import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import CustomRoleController from "../../controllers/CustomRoleController.js";

export class UpdateCustomRoleAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result: any = await CustomRoleController.update(Number(req.params.id), req.body);
      if (result?.error) { res.status(result.status ?? 400).json({ error: result.error }); return; }
      if (!result) { res.status(404).json({ error: "Not found" }); return; }
      res.json(result);
    } catch (err: any) {
      if (err.original?.code === "23505") res.status(409).json({ error: "Role name already exists" });
      else res.status(500).json({ error: "Server error" });
    }
  }
}
