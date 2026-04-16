import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import SiteController from "../../controllers/SiteController.js";

export class UpdateSiteAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { name, address, city, region, country, description } = req.body;
      if (!name?.trim()) { res.status(400).json({ error: "Site name is required" }); return; }
      const site = await SiteController.update(Number(req.params.id), { name, address, city, region, country, description });
      if (!site) { res.status(404).json({ error: "Site not found" }); return; }
      res.json(site);
    } catch (err: any) {
      if (err.name === "SequelizeUniqueConstraintError" || err.original?.code === "23505") res.status(409).json({ error: "A site with this name already exists" });
      else res.status(500).json({ error: "Server error" });
    }
  }
}
