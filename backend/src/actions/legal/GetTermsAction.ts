import { Request, Response } from "express";
import LegalController from "../../controllers/LegalController.js";

export class GetTermsAction {
  static async handle(_req: Request, res: Response) {
    try {
      const data = await LegalController.getPublicTerms();
      res.json(data);
    } catch (err) {
      console.error("GetTerms error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
