import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import SecurityController from "../../controllers/SecurityController.js";

/**
 * Lightweight, non-sensitive subset of security settings that any authenticated
 * user is allowed to read. Used by the frontend idle-timeout hook so non-admin
 * users can still respect the configured session timeout without being granted
 * access to the full /security/settings payload (which exposes lockout policy
 * and 2FA enforcement details).
 */
export class GetSessionConfigAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      const s = await SecurityController.getSettings();
      res.json({ idleTimeoutMinutes: (s as any).idleTimeoutMinutes ?? 30 });
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
