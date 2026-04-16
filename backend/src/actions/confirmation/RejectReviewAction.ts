import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import ConfirmationController from "../../controllers/ConfirmationController.js";

export class RejectReviewAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { reason } = req.body;
      const result = await ConfirmationController.reject(id, req.user!.id, reason);
      if ("error" in result) { res.status(result.status!).json({ error: result.error }); return; }
      res.json(result.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
