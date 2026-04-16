import { Request, Response } from "express";
import CareersController from "../../controllers/CareersController.js";

export class GetApplicationAction {
  static async handle(req: Request, res: Response) {
    try {
      const { token } = req.params;
      const result = await CareersController.getApplication(token);
      if (!result) { res.status(404).json({ error: "Application not found" }); return; }
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
