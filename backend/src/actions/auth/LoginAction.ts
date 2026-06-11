import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AuthController from "../../controllers/AuthController.js";
import { recordAuthEvent } from "../../lib/auth-audit.js";

export class LoginAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: "Email and password required" });
        return;
      }
      const normalizedEmail = String(email).toLowerCase().trim();
      const result = await AuthController.login(email, password);
      if ("error" in result) {
        if (result.status && result.status >= 400 && result.status < 500) {
          recordAuthEvent(req, {
            email: normalizedEmail,
            event: "login_failed",
            failureReason: result.error,
          });
        }
        res.status(result.status!).json({ error: result.error });
        return;
      }
      if ("otpRequired" in result) {
        res.json({ status: "otp_required", message: "A verification code has been sent to your email." });
        return;
      }
      if ("requires2FA" in result) {
        res.json({ requires2FA: true, pendingToken: result.pendingToken, email: result.email });
        return;
      }
      if ("requires2FASetup" in result) {
        res.json({ requires2FASetup: true, pendingToken: result.pendingToken, email: result.email });
        return;
      }
      if ("requiresTermsAcceptance" in result) {
        res.json({ requiresTermsAcceptance: true, pendingToken: result.pendingToken, termsVersion: result.termsVersion });
        return;
      }
      recordAuthEvent(req, {
        userId: result.user?.id ?? null,
        email: result.user?.email ?? normalizedEmail,
        event: "login_success",
      });
      res.json({ token: result.token, user: result.user });
    } catch (err) {
      const e = err as Error & { name?: string; original?: { code?: string; message?: string } };
      const details = {
        message: e?.message ?? String(err),
        name: e?.name,
        sequelizeCode: e?.original?.code,
        sequelizeMessage: e?.original?.message,
        stack: e?.stack,
        email: req.body?.email,
      };
      console.error("[LoginAction] Login failed with exception:", JSON.stringify(details, null, 2));
      try { (req as any).log?.error?.(details, "[LoginAction] Login failed with exception"); } catch {}
      const exposeDetails = process.env.NODE_ENV !== "production";
      res.status(500).json({
        error: "Server error",
        ...(exposeDetails ? { detail: details.message, name: details.name, stack: details.stack } : {}),
      });
    }
  }
}
