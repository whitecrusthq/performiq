import { Response } from "express";
import { AuthRequest, verify2FAPendingToken } from "../../middlewares/auth.js";
import { User } from "../../models/index.js";
import { generateSecret, generateQrDataUrl } from "../../lib/totp.js";

export class ForcedSetup2FAAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { pendingToken } = req.body;
      if (!pendingToken) { res.status(400).json({ error: "Pending token required" }); return; }

      const payload = verify2FAPendingToken(String(pendingToken));
      if (!payload || payload.purpose !== "2fa-setup") {
        res.status(401).json({ error: "Setup session expired. Please sign in again." });
        return;
      }

      const user = await User.findByPk(payload.id);
      if (!user) { res.status(404).json({ error: "User not found" }); return; }

      const { base32, otpauthUrl } = generateSecret(user.email);
      await User.update({ twoFactorPendingSecret: base32 }, { where: { id: user.id } });
      const qrCodeDataUrl = await generateQrDataUrl(otpauthUrl);

      res.json({ secret: base32, qrCodeDataUrl, otpauthUrl });
    } catch (err) {
      console.error("ForcedSetup2FA error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
