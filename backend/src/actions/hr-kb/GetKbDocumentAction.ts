import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import HrKbController from "../../controllers/HrKbController.js";

export class GetKbDocumentAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      const result = await HrKbController.getOne(id);
      if ("error" in result) return res.status(result.status!).json({ error: result.error });
      res.json(result.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
