import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AppraisalController from "../../controllers/AppraisalController.js";

export class RemoveReviewerAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result = await AppraisalController.removeReviewer(Number(req.params.id), Number(req.params.reviewerId));
      if ("error" in result) {
        res.status(result.status!).json({ error: result.error });
        return;
      }
      res.json({ reviewers: result.data });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
