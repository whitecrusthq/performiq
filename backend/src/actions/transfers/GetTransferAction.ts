import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import TransferController from "../../controllers/TransferController.js";

export class GetTransferAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result = await TransferController.getTransfer(Number(req.params.id), req.user!);
      if (!result) { res.status(404).json({ error: "Not found" }); return; }
      if ("error" in result) { res.status((result as any).status).json({ error: (result as any).error }); return; }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  }
}
