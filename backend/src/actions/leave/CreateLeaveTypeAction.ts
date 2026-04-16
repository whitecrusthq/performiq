import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import LeaveController from "../../controllers/LeaveController.js";

export class CreateLeaveTypeAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { name, label } = req.body;
      if (!name || !label) { res.status(400).json({ error: "Name and label are required" }); return; }
      const result = await LeaveController.createLeaveType(name, label);
      if ("error" in result && !("data" in result)) { res.status(result.status!).json({ error: result.error }); return; }
      res.json(result.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
