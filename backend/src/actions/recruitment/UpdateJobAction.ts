import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import RecruitmentController from "../../controllers/RecruitmentController.js";

export class UpdateJobAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result = await RecruitmentController.updateJob(Number(req.params.id), req.body, req.user!.id);
      if (!result) { res.status(404).json({ error: "Not found" }); return; }
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
