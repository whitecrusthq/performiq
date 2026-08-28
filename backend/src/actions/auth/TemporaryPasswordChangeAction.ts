import { Request, Response } from "express";
import AuthController from "../../controllers/AuthController.js";
import { verifyTemporaryPasswordPendingToken } from "../../middlewares/auth.js";

export class TemporaryPasswordChangeAction {
  static async handle(req: Request, res: Response) {
    try {
      const { pendingToken, newPassword } = req.body ?? {};
      if (typeof pendingToken !== "string" || typeof newPassword !== "string" || newPassword.length < 8) {
        res.status(400).json({ error: "A valid pending token and a new password of at least 8 characters are required" });
        return;
      }
      const payload = verifyTemporaryPasswordPendingToken(pendingToken);
      if (!payload) { res.status(401).json({ error: "Invalid or expired temporary password request" }); return; }
      const result = await AuthController.changeTemporaryPassword(
        payload.id,
        payload.email,
        payload.tokenVersion,
        newPassword
      );
      if ("error" in result) { res.status(result.status!).json({ error: result.error }); return; }
      res.json(result);
    } catch { res.status(500).json({ error: "Server error" }); }
  }
}