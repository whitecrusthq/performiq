import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import UserController from "../../controllers/UserController.js";

export class CreateBeneficiaryAction {
  static async handle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { role, id: actorId } = req.user!;
      const targetId = Number(req.params.id);
      if (role === "employee" && actorId !== targetId) { res.status(403).json({ error: "Forbidden" }); return; }
      const { name } = req.body;
      if (!name?.trim()) { res.status(400).json({ error: "Beneficiary name is required" }); return; }
      const row = await UserController.createBeneficiary(targetId, req.body);
      res.status(201).json(row);
    } catch (err) {
      console.error("POST /users/:id/beneficiaries error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
