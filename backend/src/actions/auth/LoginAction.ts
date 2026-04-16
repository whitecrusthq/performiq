import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AuthController from "../../controllers/AuthController.js";

export class LoginAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: "Email and password required" });
        return;
      }
      const result = await AuthController.login(email, password);
      if ("error" in result) {
        res.status(result.status!).json({ error: result.error });
        return;
      }
      if ("otpRequired" in result) {
        res.json({ status: "otp_required", message: "A verification code has been sent to your email." });
        return;
      }
      res.json({ token: result.token, user: result.user });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
