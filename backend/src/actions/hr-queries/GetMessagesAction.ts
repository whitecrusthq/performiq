import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import HrQueryController from "../../controllers/HrQueryController.js";

export class GetMessagesAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const result = await HrQueryController.getMessages(id, req.user!);
      if ("error" in result) return res.status(result.status!).json({ error: result.error });
      res.json(result.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
