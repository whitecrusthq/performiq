import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import DisciplinaryController from "../../controllers/DisciplinaryController.js";

export class CreateRecordAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const userId = Number(req.params.userId);
      const { subject } = req.body;
      if (!subject?.trim()) return res.status(400).json({ error: "Subject is required" });
      const result = await DisciplinaryController.createRecord(userId, req.body, req.user!.id, (req.user as any).name || req.user!.email);
      res.status(201).json(result);
    } catch (err) {
      console.error("POST disciplinary error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
