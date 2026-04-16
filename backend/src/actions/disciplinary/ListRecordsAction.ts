import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import DisciplinaryController from "../../controllers/DisciplinaryController.js";

export class ListRecordsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const userId = Number(req.params.userId);
      const result = await DisciplinaryController.listRecords(userId);
      res.json(result);
    } catch (err) {
      console.error("GET disciplinary error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
