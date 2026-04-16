import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import UserController from "../../controllers/UserController.js";

export class UpdateProfilePhotoAction {
  static async handle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { role, id: actorId } = req.user!;
      const targetId = Number(req.params.id);
      if (role === "employee" && actorId !== targetId) {
        res.status(403).json({ error: "Forbidden" }); return;
      }
      const { profilePhoto } = req.body as { profilePhoto: string | null };
      if (profilePhoto === undefined) { res.status(400).json({ error: "profilePhoto is required" }); return; }
      const result = await UserController.updateProfilePhoto(targetId, profilePhoto);
      if (!result) { res.status(404).json({ error: "User not found" }); return; }
      res.json(result);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
