import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AppraisalController from "../../controllers/AppraisalController.js";

export class RemoveReviewerAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const reviewers = await AppraisalController.removeReviewer(Number(req.params.id), Number(req.params.reviewerId));
      res.json({ reviewers });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
