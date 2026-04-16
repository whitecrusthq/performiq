import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import SiteController from "../../controllers/SiteController.js";

export class DeleteSiteAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      await SiteController.delete(Number(req.params.id));
      res.json({ message: "Site deleted" });
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
