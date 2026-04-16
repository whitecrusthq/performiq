import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import UserController from "../../controllers/UserController.js";

export class CreateEducationAction {
  static async handle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { role, id: actorId } = req.user!;
      const targetId = Number(req.params.id);
      if (role === "employee" && actorId !== targetId) { res.status(403).json({ error: "Forbidden" }); return; }
      const { schoolAttended } = req.body;
      if (!schoolAttended?.trim()) { res.status(400).json({ error: "School name is required" }); return; }
      const row = await UserController.createEducation(targetId, req.body);
      res.status(201).json(row);
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  }
}
