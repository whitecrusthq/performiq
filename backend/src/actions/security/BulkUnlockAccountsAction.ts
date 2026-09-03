import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import SecurityController from "../../controllers/SecurityController.js";

export class BulkUnlockAccountsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result = await SecurityController.bulkUnlockAccounts(req.body?.userIds, req.user!.id);
      if ("error" in result) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json(result.data);
    } catch (err) {
      console.error("PUT /security/unlock error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}