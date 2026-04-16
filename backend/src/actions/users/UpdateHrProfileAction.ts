import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import UserController from "../../controllers/UserController.js";

export class UpdateHrProfileAction {
  static async handle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { role, id: actorId } = req.user!;
      const targetId = Number(req.params.id);
      if (role === "employee" && actorId !== targetId) {
        res.status(403).json({ error: "Forbidden" }); return;
      }
      const result = await UserController.updateHrProfile(targetId, req.body);
      if (!result) { res.status(404).json({ error: "User not found" }); return; }
      res.json(result);
    } catch (err) {
      console.error("PUT /users/:id/hr-profile error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
