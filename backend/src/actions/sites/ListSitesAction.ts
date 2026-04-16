import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import SiteController from "../../controllers/SiteController.js";

export class ListSitesAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      const sites = await SiteController.listAll();
      res.json(sites);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
