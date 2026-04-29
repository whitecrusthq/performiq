import { Response } from "express";
import bcrypt from "bcryptjs";
import { AuthRequest } from "../../middlewares/auth.js";
import { User } from "../../models/index.js";
import { verifyToken } from "../../lib/totp.js";

export class Disable2FAAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { password, code } = req.body;
      if (!password || !code) {
        res.status(400).json({ error: "Password and verification code are required" });
        return;
      }

      const userId = req.user!.id;
      const user = await User.findByPk(userId);
      if (!user) { res.status(404).json({ error: "User not found" }); return; }

      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) { res.status(401).json({ error: "Incorrect password" }); return; }

      if (!user.twoFactorEnabled || !user.twoFactorSecret) {
        res.status(400).json({ error: "Two-factor authentication is not enabled" });
        return;
      }
      if (!verifyToken(user.twoFactorSecret, String(code))) {
        res.status(401).json({ error: "Invalid verification code" });
        return;
      }

      await User.update({
        twoFactorSecret: null,
        twoFactorPendingSecret: null,
        twoFactorEnabled: false,
        twoFactorBackupCodes: null,
      }, { where: { id: userId } });

      res.json({ disabled: true });
    } catch (err) {
      console.error("Disable2FA error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
