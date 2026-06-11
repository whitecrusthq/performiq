import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import LegalController from "../../controllers/LegalController.js";

export class GetMyAcceptanceAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const data = await LegalController.getMyAcceptance(req.user!.id);
      res.json(data);
    } catch (err) {
      console.error("GetMyAcceptance error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
