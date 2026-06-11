import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import LegalController from "../../controllers/LegalController.js";

export class GetLegalAdminAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      const data = await LegalController.getAdmin();
      res.json(data);
    } catch (err) {
      console.error("GetLegalAdmin error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
