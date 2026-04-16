import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import CycleController from "../../controllers/CycleController.js";

export class GetCycleAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const cycle = await CycleController.getById(Number(req.params.id));
      if (!cycle) { res.status(404).json({ error: "Cycle not found" }); return; }
      res.json(cycle);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
