import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import HrQueryController from "../../controllers/HrQueryController.js";

export class ListQueriesAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result = await HrQueryController.listQueries(req.user!);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch queries" });
    }
  }
}
