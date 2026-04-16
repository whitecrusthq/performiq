import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AuthController from "../../controllers/AuthController.js";

export class ChangePasswordAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        res.status(400).json({ error: "Current and new password are required" });
        return;
      }
      if (newPassword.length < 6) {
        res.status(400).json({ error: "New password must be at least 6 characters" });
        return;
      }
      const result = await AuthController.changePassword(req.user!.id, currentPassword, newPassword);
      if ("error" in result) {
        res.status(result.status!).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
