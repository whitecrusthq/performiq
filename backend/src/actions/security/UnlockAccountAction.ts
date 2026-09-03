import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import SecurityController from "../../controllers/SecurityController.js";

export class UnlockAccountAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const userId = parseInt(req.params.id as string);
      if (isNaN(userId)) { res.status(400).json({ error: "Invalid user id" }); return; }
      const result = await SecurityController.unlockAccount(userId, req.user!.id);
      if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
      res.json({ ...result.data, message: "Account unlocked successfully" });
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
