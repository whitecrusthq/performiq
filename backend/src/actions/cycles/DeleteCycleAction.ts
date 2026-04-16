import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import CycleController from "../../controllers/CycleController.js";

export class DeleteCycleAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      await CycleController.delete(Number(req.params.id));
      res.json({ message: "Cycle deleted" });
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
