import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import RecruitmentController from "../../controllers/RecruitmentController.js";

export class ListJobsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result = await RecruitmentController.listJobs();
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
