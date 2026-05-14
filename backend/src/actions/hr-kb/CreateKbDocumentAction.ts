import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import HrKbController from "../../controllers/HrKbController.js";

export class CreateKbDocumentAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result = await HrKbController.create(req.user!.id, req.body);
      if ("error" in result) return res.status(result.status!).json({ error: result.error });
      res.status(result.status ?? 201).json(result.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
