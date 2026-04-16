import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import CycleController from "../../controllers/CycleController.js";

export class ListCyclesAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      const cycles = await CycleController.getAll();
      res.json(cycles);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
