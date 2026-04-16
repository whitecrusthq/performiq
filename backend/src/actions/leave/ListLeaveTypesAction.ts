import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import LeaveController from "../../controllers/LeaveController.js";

export class ListLeaveTypesAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      const types = await LeaveController.listLeaveTypes();
      res.json(types);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
