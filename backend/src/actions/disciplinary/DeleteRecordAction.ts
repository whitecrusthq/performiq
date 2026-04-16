import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import DisciplinaryController from "../../controllers/DisciplinaryController.js";

export class DeleteRecordAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      await DisciplinaryController.deleteRecord(id);
      res.json({ success: true });
    } catch (err) {
      console.error("DELETE disciplinary error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
