import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import UserController from "../../controllers/UserController.js";

export class GetBeneficiariesAction {
  static async handle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { role, id: actorId } = req.user!;
      const targetId = Number(req.params.id);
      if (role === "employee" && actorId !== targetId) { res.status(403).json({ error: "Forbidden" }); return; }
      const rows = await UserController.getBeneficiaries(targetId);
      res.json(rows);
    } catch (err) {
      console.error("GET /users/:id/beneficiaries error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
