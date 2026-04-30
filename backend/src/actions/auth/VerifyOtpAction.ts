import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AuthController from "../../controllers/AuthController.js";
import { recordAuthEvent } from "../../lib/auth-audit.js";

export class VerifyOtpAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        res.status(400).json({ error: "Email and OTP are required" });
        return;
      }
      const normalizedEmail = String(email).toLowerCase().trim();
      const result = await AuthController.verifyOtp(email, otp);
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
      recordAuthEvent(req, {
        userId: result.user?.id ?? null,
        email: result.user?.email ?? normalizedEmail,
        event: "login_success",
      });
      res.json({ token: result.token, user: result.user });
    } catch (err) {
      console.error("Verify OTP error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
