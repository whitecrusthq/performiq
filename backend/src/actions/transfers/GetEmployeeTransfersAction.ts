import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import TransferController from "../../controllers/TransferController.js";

export class GetEmployeeTransfersAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const employeeId = Number(req.params.employeeId);
      if (!employeeId || isNaN(employeeId)) { res.status(400).json({ error: "Invalid employeeId" }); return; }
      const result = await TransferController.getEmployeeTransfers(employeeId, req.user!);
      if ("error" in result) { res.status(result.status!).json({ error: result.error }); return; }
      res.json(result.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
