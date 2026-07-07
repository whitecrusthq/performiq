import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import UserController from "../../controllers/UserController.js";

export class Reset2FAAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result = await UserController.reset2FA(
        Number(req.params.id),
        req.user!.id,
        req.user!.role
      );
      if ("error" in result) {
        res.status(result.status!).json({ error: result.error });
        return;
      }
      res.json(result.data);
    } catch (err) {
      console.error("POST /users/:id/reset-2fa error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
