import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import SiteController from "../../controllers/SiteController.js";

export class BulkImportSitesAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { sites: rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        res.status(400).json({ error: "sites array is required and must not be empty" });
        return;
      }
      if (rows.length > 500) {
        res.status(400).json({ error: "Maximum 500 sites per import" });
        return;
      }
      // 2FA policy stays with admins, so delegated imports drop the column.
      const allowed = req.isFullAdmin ? rows : rows.map(({ require2Fa, require2fa, ...rest }: any) => rest);
      const result = await SiteController.bulkImport(allowed);
      res.json(result);
    } catch (err) {
      console.error("POST /sites/bulk-import error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
