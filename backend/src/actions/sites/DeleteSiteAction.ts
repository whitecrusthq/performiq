import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import SiteController from "../../controllers/SiteController.js";

export class DeleteSiteAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      // Deleting a site unlinks its users, which would drop them out of its 2FA requirement.
      if (!req.isFullAdmin && (await SiteController.find(id))?.require2Fa) {
        res.status(403).json({ error: "Only an admin can delete a site that requires 2FA" });
        return;
      }
      await SiteController.delete(id);
      res.json({ message: "Site deleted" });
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
