import { Request, Response } from "express";
import CareersController from "../../controllers/CareersController.js";

export class GetJobAction {
  static async handle(req: Request, res: Response) {
    try {
      const result = await CareersController.getJob(Number(req.params.id));
      if (!result) { res.status(404).json({ error: "Job not found or no longer open" }); return; }
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
