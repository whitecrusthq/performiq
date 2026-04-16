import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import RecruitmentController from "../../controllers/RecruitmentController.js";

export class HireCandidateAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result = await RecruitmentController.hireCandidate(Number(req.params.id), req.body, req.user!);
      if ("error" in result) { res.status(result.status!).json({ error: result.error }); return; }
      res.json(result.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
