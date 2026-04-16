import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import TransferController from "../../controllers/TransferController.js";

export class GetTransferAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result = await TransferController.getTransfer(Number(req.params.id));
      if (!result) { res.status(404).json({ error: "Not found" }); return; }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  }
}
