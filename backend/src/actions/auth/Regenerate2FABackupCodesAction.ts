import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import { User } from "../../models/index.js";
import { verifyToken, generateBackupCodes, hashBackupCodes } from "../../lib/totp.js";

export class Regenerate2FABackupCodesAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { code } = req.body;
      if (!code) { res.status(400).json({ error: "Verification code is required" }); return; }

      const userId = req.user!.id;
      const user = await User.findByPk(userId);
      if (!user) { res.status(404).json({ error: "User not found" }); return; }
      if (!user.twoFactorEnabled || !user.twoFactorSecret) {
        res.status(400).json({ error: "Two-factor authentication is not enabled" });
        return;
      }
      if (!verifyToken(user.twoFactorSecret, String(code))) {
        res.status(401).json({ error: "Invalid verification code" });
        return;
      }

      const backupCodes = generateBackupCodes(10);
      const hashed = await hashBackupCodes(backupCodes);
      await User.update({ twoFactorBackupCodes: JSON.stringify(hashed) }, { where: { id: userId } });

      res.json({ backupCodes });
    } catch (err) {
      console.error("Regenerate2FA error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
