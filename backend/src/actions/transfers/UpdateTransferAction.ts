import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import TransferController from "../../controllers/TransferController.js";

export class UpdateTransferAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result = await TransferController.updateTransfer(Number(req.params.id), req.body, req.user!);
      if ("error" in result) { res.status(result.status!).json({ error: result.error }); return; }
      res.json(result.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
