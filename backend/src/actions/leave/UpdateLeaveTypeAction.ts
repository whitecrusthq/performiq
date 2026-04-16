import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import LeaveController from "../../controllers/LeaveController.js";

export class UpdateLeaveTypeAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { label } = req.body;
      if (!label) { res.status(400).json({ error: "Label is required" }); return; }
      const updated = await LeaveController.updateLeaveType(Number(req.params.id), label);
      if (!updated) { res.status(404).json({ error: "Not found" }); return; }
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
