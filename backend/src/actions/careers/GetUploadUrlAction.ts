import { Request, Response } from "express";
import CareersController from "../../controllers/CareersController.js";

export class GetUploadUrlAction {
  static async handle(_req: Request, res: Response) {
    try {
      const result = await CareersController.getUploadUrl();
      res.json(result);
    } catch (err: any) {
      console.error("Careers upload URL error:", err);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  }
}
