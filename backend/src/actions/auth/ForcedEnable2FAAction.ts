import { Response } from "express";
import { AuthRequest, verify2FAPendingToken, generateToken } from "../../middlewares/auth.js";
import { User, CustomRole } from "../../models/index.js";
import { verifyToken, generateBackupCodes, hashBackupCodes } from "../../lib/totp.js";

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

      const customRole = user.customRoleId ? await CustomRole.findByPk(user.customRoleId) : null;
      const token = generateToken({ id: user.id, role: user.role, email: user.email, customRoleName: customRole?.name ?? null });

      const reloaded = await User.findByPk(user.id);
      res.json({
        token,
        backupCodes,
        user: {
          id: reloaded!.id, name: reloaded!.name, email: reloaded!.email, role: reloaded!.role,
          managerId: reloaded!.managerId, siteId: reloaded!.siteId, department: reloaded!.department,
          jobTitle: reloaded!.jobTitle, phone: reloaded!.phone, staffId: reloaded!.staffId, createdAt: reloaded!.createdAt,
          twoFactorEnabled: true,
          customRoleId: reloaded!.customRoleId ?? null,
          customRole: customRole ? {
            id: customRole.id, name: customRole.name, permissionLevel: customRole.permissionLevel,
            menuPermissions: (() => { try { return JSON.parse(customRole.menuPermissions ?? "[]"); } catch { return []; } })(),
          } : null,
        },
      });
    } catch (err) {
      console.error("ForcedEnable2FA error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
