import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import RecruitmentController from "../../controllers/RecruitmentController.js";

export class DeleteCandidateAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      await RecruitmentController.deleteCandidate(Number(req.params.id));
      res.json({ message: "Deleted" });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  }
}
