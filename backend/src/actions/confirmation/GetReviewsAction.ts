import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import ConfirmationController from "../../controllers/ConfirmationController.js";

export class GetReviewsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const employeeId = parseInt(req.params.employeeId);
      const result = await ConfirmationController.getReviews(employeeId);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
