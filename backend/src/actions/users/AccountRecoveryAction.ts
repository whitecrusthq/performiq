import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AccountRecoveryController from "../../controllers/AccountRecoveryController.js";
import { recoveryContext } from "../../lib/account-recovery.js";

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

  static async requests(req: AuthRequest, res: Response) {
    const status = typeof req.query.status === "string" ? req.query.status : "all";
    if (!["all", "pending", "approved", "rejected", "expired"].includes(status)) {
      res.status(400).json({ error: "Invalid status" }); return;
    }
    try {
      const result = await AccountRecoveryController.listRequests(req.user!.id, status, recoveryContext(req));
      if (!Array.isArray(result) && "error" in result) { res.status(result.status).json({ error: result.error }); return; }
      res.json(result);
    } catch { res.status(500).json({ error: "Server error" }); }
  }

  static async approve(req: AuthRequest, res: Response) {
    try {
      const result = await AccountRecoveryController.resolveRequest(
        Number(req.params.id), req.user!.id, "approved", null, recoveryContext(req),
      );
      if ("error" in result) { res.status(Number(result.status)).json({ error: result.error }); return; }
      res.json(result);
    } catch { res.status(500).json({ error: "Server error" }); }
  }

  static async reject(req: AuthRequest, res: Response) {
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!reason || reason.length > 1000) {
      res.status(400).json({ error: "A rejection reason of at most 1000 characters is required" }); return;
    }
    try {
      const result = await AccountRecoveryController.resolveRequest(
        Number(req.params.id), req.user!.id, "rejected", reason, recoveryContext(req),
      );
      if ("error" in result) { res.status(Number(result.status)).json({ error: result.error }); return; }
      res.json(result);
    } catch { res.status(500).json({ error: "Server error" }); }
  }
}