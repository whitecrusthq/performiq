import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AuthController from "../../controllers/AuthController.js";

export class VerifyOtpAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        res.status(400).json({ error: "Email and OTP are required" });
        return;
      }
      const result = await AuthController.verifyOtp(email, otp);
      if ("error" in result) {
        res.status(result.status!).json({ error: result.error });
        return;
      }
      res.json({ token: result.token, user: result.user });
    } catch (err) {
      console.error("Verify OTP error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
