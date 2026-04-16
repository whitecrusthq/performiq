import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import OnboardingController from "../../controllers/OnboardingController.js";

export class ListWorkflowsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { type, status, employeeId } = req.query;
      const result = await OnboardingController.listWorkflows({
        type: type as string | undefined,
        status: status as string | undefined,
        employeeId: employeeId ? parseInt(employeeId as string) : undefined,
        userRole: req.user!.role,
        userId: req.user!.id,
      });
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
