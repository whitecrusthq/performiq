import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import UserController from "../../controllers/UserController.js";

export class UpdateEducationAction {
  static async handle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { role, id: actorId } = req.user!;
      const targetId = Number(req.params.id);
      if (role === "employee" && actorId !== targetId) { res.status(403).json({ error: "Forbidden" }); return; }
      const row = await UserController.updateEducation(Number(req.params.rowId), req.body);
      res.json(row);
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  }
}
