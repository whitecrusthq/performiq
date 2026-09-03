import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import SecurityController from "../../controllers/SecurityController.js";

export class GetLockedAccountsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const locked = await SecurityController.getLockedAccounts(req.user!.id);
      res.json(locked);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
