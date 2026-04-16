import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import HrQueryController from "../../controllers/HrQueryController.js";

export class CreateMessageAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { body } = req.body;
      if (!body?.trim()) return res.status(400).json({ error: "Message body required" });
      const result = await HrQueryController.createMessage(id, req.user!, body);
      if ("error" in result) return res.status(result.status!).json({ error: result.error });
      res.status(201).json(result.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
