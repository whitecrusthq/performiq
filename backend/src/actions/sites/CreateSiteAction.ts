import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import SiteController from "../../controllers/SiteController.js";

export class CreateSiteAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { name, address, city, region, country, description, require2Fa } = req.body;
      if (!name?.trim()) { res.status(400).json({ error: "Site name is required" }); return; }
      const site = await SiteController.create({ name, address, city, region, country, description, require2Fa });
      res.status(201).json(site);
    } catch (err: any) {
      if (err.name === "SequelizeUniqueConstraintError" || err.original?.code === "23505") res.status(409).json({ error: "A site with this name already exists" });
      else res.status(500).json({ error: "Server error" });
    }
  }
}
