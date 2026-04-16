import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import CycleController from "../../controllers/CycleController.js";

export class CreateCycleAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { name, startDate, endDate, status } = req.body;
      const cycle = await CycleController.create({ name, startDate, endDate, status });
      res.status(201).json(cycle);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
