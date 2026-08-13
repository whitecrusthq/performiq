import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import LeaveController from "../../controllers/LeaveController.js";

export class ListLeaveTypesAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      // ?forMe=1 filters the list to types the requesting user's grade allows
      const forMe = req.query.forMe === "1" && req.user ? req.user.id : undefined;
      const types = await LeaveController.listLeaveTypes(forMe);
      res.json(types);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
