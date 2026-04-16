import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AppraisalController from "../../controllers/AppraisalController.js";

export class AddReviewerAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { reviewerId } = req.body;
      if (!reviewerId) { res.status(400).json({ error: "reviewerId required" }); return; }

      const result = await AppraisalController.addReviewer(Number(req.params.id), Number(reviewerId));
      if (result.error) {
        res.status(result.status!).json({ error: result.error }); return;
      }
      res.json(result.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
