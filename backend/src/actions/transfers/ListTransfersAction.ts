import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import TransferController from "../../controllers/TransferController.js";

export class ListTransfersAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result = await TransferController.listTransfers(req.user!);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
