import { Response } from "express";
import { AuthRequest, verify2FAPendingToken } from "../../middlewares/auth.js";
import { User } from "../../models/index.js";
import { verifyToken, generateBackupCodes, hashBackupCodes } from "../../lib/totp.js";
import { recordAuthEvent } from "../../lib/auth-audit.js";
import AuthController from "../../controllers/AuthController.js";

export class ForcedEnable2FAAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { pendingToken, code } = req.body;
      if (!pendingToken || !code) {
        res.status(400).json({ error: "Pending token and code are required" });
        return;
      }

      const payload = verify2FAPendingToken(String(pendingToken));
      if (!payload || payload.purpose !== "2fa-setup") {
        res.status(401).json({ error: "Setup session expired. Please sign in again." });
        return;
      }

      const user = await User.findByPk(payload.id);
      if (!user) { res.status(404).json({ error: "User not found" }); return; }
      if (user.isActive === false) {
        res.status(403).json({ error: "This account has been deactivated. Please contact your administrator." });
        return;
      }
      if (!user.twoFactorPendingSecret) {
        res.status(400).json({ error: "No setup in progress. Please scan the QR code first." });
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
      }, { where: { id: user.id } });

      const reloaded = await User.findByPk(user.id);
      // Run the shared login finalizer so the Terms & Conditions gate is enforced
      // here too — never mint a session directly and bypass it. Backup codes are
      // returned regardless (they were just generated and can't be re-shown).
      const result = await AuthController.finalize(reloaded!);

      if ("requiresTermsAcceptance" in result) {
        res.json({
          backupCodes,
          requiresTermsAcceptance: true,
          pendingToken: result.pendingToken,
          termsVersion: result.termsVersion,
        });
        return;
      }

      recordAuthEvent(req, {
        userId: user.id,
        email: user.email,
        event: "login_success",
      });
      res.json({
        token: result.token,
        backupCodes,
        user: result.user,
      });
    } catch (err) {
      console.error("ForcedEnable2FA error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
