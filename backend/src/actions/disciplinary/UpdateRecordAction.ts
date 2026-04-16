import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import DisciplinaryController from "../../controllers/DisciplinaryController.js";

export class UpdateRecordAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const result = await DisciplinaryController.updateRecord(id, req.body);
      if (!result) return res.status(404).json({ error: "Record not found" });
      res.json(result);
    } catch (err) {
      console.error("PUT disciplinary error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
