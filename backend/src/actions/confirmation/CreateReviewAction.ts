import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import ConfirmationController from "../../controllers/ConfirmationController.js";

export class CreateReviewAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { employeeId, notes } = req.body;
      if (!employeeId) { res.status(400).json({ error: "employeeId is required" }); return; }
      const result = await ConfirmationController.createReview(employeeId, req.user!.id, notes);
      if ("error" in result) {
        res.status(result.status!).json({ error: result.error, ...(result.review ? { review: result.review } : {}) });
        return;
      }
      res.status(201).json(result.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
