import { Response } from "express";
import { AuthRequest, verify2FAPendingToken } from "../../middlewares/auth.js";
import AuthController from "../../controllers/AuthController.js";
import { recordAuthEvent } from "../../lib/auth-audit.js";

export class Verify2FAAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { pendingToken, code } = req.body;
      if (!pendingToken || !code) {
        res.status(400).json({ error: "Pending token and code are required" });
        return;
      }
      const payload = verify2FAPendingToken(String(pendingToken));
      if (!payload || payload.purpose !== "2fa-verify") {
        res.status(401).json({ error: "Verification session expired. Please sign in again." });
        return;
      }
      const result = await AuthController.verify2FA(payload.id, String(code));
      if ("error" in result) {
        if (result.status && result.status >= 400 && result.status < 500) {
          recordAuthEvent(req, {
            userId: payload.id,
            email: payload.email,
            event: "login_failed",
            failureReason: `2FA: ${result.error}`,
          });
        }
        res.status(result.status!).json({ error: result.error });
        return;
      }
      if ("requiresTermsAcceptance" in result) {
        res.json({ requiresTermsAcceptance: true, pendingToken: result.pendingToken, termsVersion: result.termsVersion });
        return;
      }
      recordAuthEvent(req, {
        userId: result.user?.id ?? payload.id,
        email: result.user?.email ?? payload.email,
        event: "login_success",
      });
      res.json({ token: result.token, user: result.user });
    } catch (err) {
      console.error("Verify2FA error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
