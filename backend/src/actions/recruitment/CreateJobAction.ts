import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import RecruitmentController from "../../controllers/RecruitmentController.js";

export class CreateJobAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { title } = req.body;
      if (!title) { res.status(400).json({ error: "Title is required" }); return; }
      const result = await RecruitmentController.createJob(req.body, req.user!.id);
      res.status(201).json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
