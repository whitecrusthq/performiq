import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import StaffEmailController from "../../controllers/StaffEmailController.js";

export class ListStaffEmailHistoryAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      res.json(await StaffEmailController.history());
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
