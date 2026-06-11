import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import HrKbController from "../../controllers/HrKbController.js";

export class ListKbDocumentsAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      const rows = await HrKbController.list();
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
