import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import { User } from "../../models/index.js";
import { verifyToken, generateBackupCodes, hashBackupCodes } from "../../lib/totp.js";

export class Enable2FAAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { code } = req.body;
      if (!code) { res.status(400).json({ error: "Verification code is required" }); return; }

      const userId = req.user!.id;
      const user = await User.findByPk(userId);
      if (!user) { res.status(404).json({ error: "User not found" }); return; }
      if (!user.twoFactorPendingSecret) {
        res.status(400).json({ error: "No setup in progress. Please start the setup again." });
        return;
      }
      if (!verifyToken(user.twoFactorPendingSecret, String(code))) {
        res.status(401).json({ error: "Invalid verification code. Please try again." });
        return;
      }

      const backupCodes = generateBackupCodes(10);
      const hashed = await hashBackupCodes(backupCodes);

      await User.update({
        twoFactorSecret: user.twoFactorPendingSecret,
        twoFactorPendingSecret: null,
        twoFactorEnabled: true,
        twoFactorBackupCodes: JSON.stringify(hashed),
      }, { where: { id: userId } });

      res.json({ enabled: true, backupCodes });
    } catch (err) {
      console.error("Enable2FA error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
