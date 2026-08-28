import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AccountRecoveryController from "../../controllers/AccountRecoveryController.js";

export class AccountRecoveryAction {
  static async list(req: AuthRequest, res: Response) {
    try { res.json(await AccountRecoveryController.list(req.user!.id)); }
    catch { res.status(500).json({ error: "Server error" }); }
  }

  static async password(req: AuthRequest, res: Response) {
    try {
      const temporaryPassword = req.body?.temporaryPassword;
      if (typeof temporaryPassword !== "string" || temporaryPassword.length < 8) {
        res.status(400).json({ error: "Temporary password must be at least 8 characters" }); return;
      }
      const result = await AccountRecoveryController.setTemporaryPassword(Number(req.params.id), req.user!.id, temporaryPassword);
      if ("error" in result) { res.status(result.status!).json({ error: result.error }); return; }
      res.json(result);
    } catch { res.status(500).json({ error: "Server error" }); }
  }

  static async reset2FA(req: AuthRequest, res: Response) {
    try {
      const result = await AccountRecoveryController.reset2FA(Number(req.params.id), req.user!.id);
      if ("error" in result) { res.status(result.status!).json({ error: result.error }); return; }
      res.json(result);
    } catch { res.status(500).json({ error: "Server error" }); }
  }
}