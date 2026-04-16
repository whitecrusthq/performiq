import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import CycleController from "../../controllers/CycleController.js";

export class UpdateCycleAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { name, startDate, endDate, status } = req.body;
      const cycle = await CycleController.update(Number(req.params.id), { name, startDate, endDate, status });
      if (!cycle) { res.status(404).json({ error: "Cycle not found" }); return; }
      res.json(cycle);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
