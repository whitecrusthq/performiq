import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import LeaveController from "../../controllers/LeaveController.js";

export class ListLeavePoliciesAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const u = req.user!;
      const policies = await LeaveController.listPolicies({
        id: u.id,
        role: u.role,
        customRoleName: (u as any).customRoleName ?? null,
      });
      res.json(policies);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
