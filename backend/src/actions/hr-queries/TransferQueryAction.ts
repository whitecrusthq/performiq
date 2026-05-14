import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import HrQueryController from "../../controllers/HrQueryController.js";

export class TransferQueryAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
      const result = await HrQueryController.transferQuery(id, req.user!, req.body);
      if ("error" in result) return res.status(result.status!).json({ error: result.error });
      return res.json(result.data);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to transfer query" });
    }
  }
}
