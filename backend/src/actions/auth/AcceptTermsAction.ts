import { Response } from "express";
import { AuthRequest, verifyTermsPendingToken } from "../../middlewares/auth.js";
import AuthController from "../../controllers/AuthController.js";
import { recordAuthEvent } from "../../lib/auth-audit.js";

export class AcceptTermsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { pendingToken } = req.body ?? {};
      if (!pendingToken) {
        res.status(400).json({ error: "Pending token is required" });
        return;
      }
      const payload = verifyTermsPendingToken(String(pendingToken));
      if (!payload) {
        res.status(401).json({ error: "Your session expired. Please sign in again." });
        return;
      }
      const ip = (req.ip ?? null) as string | null;
      const result = await AuthController.acceptTerms(payload.id, payload.version, ip);
      if ("error" in result) {
        if (result.status && result.status >= 400 && result.status < 500) {
          recordAuthEvent(req, {
            userId: payload.id,
            email: payload.email,
            event: "login_failed",
            failureReason: `Terms: ${result.error}`,
          });
        }
        res.status(result.status!).json({ error: result.error });
        return;
      }
      // After acceptance the gate must pass; if it somehow still requires terms,
      // surface it rather than silently looping.
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
      console.error("AcceptTerms error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
