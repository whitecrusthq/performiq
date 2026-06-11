import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import LegalController from "../../controllers/LegalController.js";

export class UpdatePrivacyPolicyAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { content, published } = req.body ?? {};
      const data = await LegalController.updatePrivacy({
        content: typeof content === "string" ? content : "",
        published: !!published,
      });
      res.json(data);
    } catch (err) {
      console.error("UpdatePrivacyPolicy error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
