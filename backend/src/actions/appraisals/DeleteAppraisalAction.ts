import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AppraisalController from "../../controllers/AppraisalController.js";

export class DeleteAppraisalAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      await AppraisalController.delete(Number(req.params.id));
      res.json({ message: "Appraisal deleted" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
