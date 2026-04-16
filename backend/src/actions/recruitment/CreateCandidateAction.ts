import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import RecruitmentController from "../../controllers/RecruitmentController.js";

export class CreateCandidateAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { firstName, surname, email } = req.body;
      if (!firstName || !surname || !email) {
        res.status(400).json({ error: "firstName, surname, and email are required" }); return;
      }
      const result = await RecruitmentController.createCandidate(Number(req.params.jobId), req.body);
      if ("error" in result) { res.status(result.status!).json({ error: result.error }); return; }
      res.status(201).json(result.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
