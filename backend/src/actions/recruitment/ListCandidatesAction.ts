import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import RecruitmentController from "../../controllers/RecruitmentController.js";

export class ListCandidatesAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result = await RecruitmentController.listCandidates(Number(req.params.jobId));
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  }
}
