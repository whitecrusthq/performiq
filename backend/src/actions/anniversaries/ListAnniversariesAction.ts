import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AnniversaryController from "../../controllers/AnniversaryController.js";

export class ListAnniversariesAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result = await AnniversaryController.listAnniversaries();
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
