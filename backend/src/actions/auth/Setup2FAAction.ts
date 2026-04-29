import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import { User } from "../../models/index.js";
import { generateSecret, generateQrDataUrl } from "../../lib/totp.js";

export class Setup2FAAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const user = await User.findByPk(userId);
      if (!user) { res.status(404).json({ error: "User not found" }); return; }

      const { base32, otpauthUrl } = generateSecret(user.email);
      await User.update({ twoFactorPendingSecret: base32 }, { where: { id: userId } });
      const qrCodeDataUrl = await generateQrDataUrl(otpauthUrl);

      res.json({ secret: base32, qrCodeDataUrl, otpauthUrl });
    } catch (err) {
      console.error("Setup2FA error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
