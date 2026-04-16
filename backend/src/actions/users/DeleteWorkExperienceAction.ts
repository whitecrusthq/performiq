import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import UserController from "../../controllers/UserController.js";

export class DeleteWorkExperienceAction {
  static async handle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { role, id: actorId } = req.user!;
      const targetId = Number(req.params.id);
      if (role === "employee" && actorId !== targetId) { res.status(403).json({ error: "Forbidden" }); return; }
      await UserController.deleteWorkExperience(Number(req.params.rowId));
      res.json({ message: "Deleted" });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  }
}
