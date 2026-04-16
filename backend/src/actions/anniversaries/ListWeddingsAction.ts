import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AnniversaryController from "../../controllers/AnniversaryController.js";

export class ListWeddingsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result = await AnniversaryController.listWeddings();
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
