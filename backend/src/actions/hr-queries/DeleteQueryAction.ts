import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import HrQueryController from "../../controllers/HrQueryController.js";

export class DeleteQueryAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const result = await HrQueryController.deleteQuery(id, req.user!);
      if ("error" in result) return res.status(result.status!).json({ error: result.error });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete query" });
    }
  }
}
