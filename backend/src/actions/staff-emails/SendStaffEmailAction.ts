import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import StaffEmailController from "../../controllers/StaffEmailController.js";

export class SendStaffEmailAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result = await StaffEmailController.send(req.user!.id, req.body);
      if ("error" in result) {
        res.status(result.status ?? 400).json({ error: result.error });
        return;
      }
      res.status(202).json(result.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
