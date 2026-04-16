import { Request, Response } from "express";
import CareersController from "../../controllers/CareersController.js";

export class ApplyAction {
  static async handle(req: Request, res: Response) {
    try {
      const jobId = Number(req.params.jobId);
      const { firstName, surname, email } = req.body;
      if (!firstName || !surname || !email) {
        res.status(400).json({ error: "First name, surname, and email are required" }); return;
      }
      const result = await CareersController.apply(jobId, req.body);
      if ("error" in result) { res.status(result.status!).json({ error: result.error }); return; }
      res.status(201).json(result.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
