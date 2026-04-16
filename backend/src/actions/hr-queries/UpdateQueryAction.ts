import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import HrQueryController from "../../controllers/HrQueryController.js";

export class UpdateQueryAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const result = await HrQueryController.updateQuery(id, req.user!, req.body);
      if ("error" in result) return res.status(result.status!).json({ error: result.error });
      res.json(result.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update query" });
    }
  }
}
