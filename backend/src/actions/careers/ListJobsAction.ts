import { Request, Response } from "express";
import CareersController from "../../controllers/CareersController.js";

export class ListJobsAction {
  static async handle(_req: Request, res: Response) {
    try {
      const result = await CareersController.listJobs();
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
