import { Request, Response } from "express";
import LegalController from "../../controllers/LegalController.js";

export class GetPrivacyPolicyAction {
  static async handle(_req: Request, res: Response) {
    try {
      const data = await LegalController.getPublicPrivacy();
      res.json(data);
    } catch (err) {
      console.error("GetPrivacyPolicy error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
