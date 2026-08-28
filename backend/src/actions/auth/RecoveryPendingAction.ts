import { Response } from "express";
import { AuthRequest, verifyRecoveryPendingToken } from "../../middlewares/auth.js";
import AccountRecoveryController from "../../controllers/AccountRecoveryController.js";
import { recoveryContext } from "../../lib/account-recovery.js";

export class RecoveryPendingAction {
  private static token(req: AuthRequest) {
    // Tokens must never be accepted from a URL or body, where proxies, browser
    // history, and application logging can retain them.
    const bearer = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : "";
    return verifyRecoveryPendingToken(bearer);
  }

  static async status(req: AuthRequest, res: Response) {
    const payload = RecoveryPendingAction.token(req);
    if (!payload) { res.status(401).json({ error: "Invalid or expired recovery token" }); return; }
    try {
      const result = await AccountRecoveryController.publicStatus(
        payload.id, payload.requestId, payload.tokenVersion, recoveryContext(req),
      );
      if ("error" in result) { res.status(Number(result.status)).json({ error: result.error }); return; }
      res.json(result);
    } catch { res.status(500).json({ error: "Server error" }); }
  }

  static async report(req: AuthRequest, res: Response) {
    const payload = RecoveryPendingAction.token(req);
    if (!payload) { res.status(401).json({ error: "Invalid or expired recovery token" }); return; }
    try {
      const result = await AccountRecoveryController.report(
        payload.id, payload.requestId, payload.tokenVersion, recoveryContext(req),
      );
      if ("error" in result) { res.status(Number(result.status ?? 500)).json({ error: result.error }); return; }
      res.json(result);
    } catch { res.status(500).json({ error: "Server error" }); }
  }
}