import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import TransferController from "../../controllers/TransferController.js";

export class CreateTransferAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { employeeId, toSiteId, reason, effectiveDate } = req.body;
      if (!employeeId || !toSiteId || !reason || !effectiveDate) {
        res.status(400).json({ error: "employeeId, toSiteId, reason, and effectiveDate are required" }); return;
      }
      const result = await TransferController.createTransfer(req.body, req.user!.id);
      res.status(201).json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
