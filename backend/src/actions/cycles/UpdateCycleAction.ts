import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import CycleController from "../../controllers/CycleController.js";

export class UpdateCycleAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { name, startDate, endDate, status, scoringMode, selfWeight, upwardIncluded } = req.body;
      const cycle = await CycleController.update(Number(req.params.id), { name, startDate, endDate, status, scoringMode, selfWeight, upwardIncluded });
      if (!cycle) { res.status(404).json({ error: "Cycle not found" }); return; }
      res.json(cycle);
    } catch (err: any) {
      if (typeof err?.message === "string" && err.message.startsWith("VALIDATION:")) {
        res.status(400).json({ error: err.message.slice("VALIDATION:".length) });
        return;
      }
      res.status(500).json({ error: "Server error" });
    }
  }
}
