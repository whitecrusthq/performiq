import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import LeaveController from "../../controllers/LeaveController.js";

export class ListLeavePoliciesAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      const policies = await LeaveController.listPolicies();
      res.json(policies);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
