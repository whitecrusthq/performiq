import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import HrQueryController from "../../controllers/HrQueryController.js";
import HrKbController from "../../controllers/HrKbController.js";

export class SuggestReplyAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      if (!HrQueryController.isHR(req.user!)) {
        return res.status(403).json({ error: "Only HR can request AI suggestions" });
      }
      const id = parseInt(req.params.id, 10);
      const result = await HrKbController.suggestReply(id);
      if ("error" in result) return res.status(result.status!).json({ error: result.error });
      res.json(result.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
