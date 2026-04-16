import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import UserController from "../../controllers/UserController.js";

export class BulkImportAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { users: rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        res.status(400).json({ error: "users array is required and must not be empty" });
        return;
      }
      if (rows.length > 500) {
        res.status(400).json({ error: "Maximum 500 users per import" });
        return;
      }
      const result = await UserController.bulkImport(rows, req.user!.role);
      res.json(result);
    } catch (err) {
      console.error("POST /users/bulk-import error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
