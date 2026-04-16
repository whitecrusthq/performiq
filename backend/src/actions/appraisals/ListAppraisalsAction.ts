import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AppraisalController from "../../controllers/AppraisalController.js";

export class ListAppraisalsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { cycleId, employeeId } = req.query;
      const enriched = await AppraisalController.getAll({
        cycleId: cycleId ? Number(cycleId) : undefined,
        employeeId: employeeId ? Number(employeeId) : undefined,
        userRole: req.user!.role,
        userId: req.user!.id,
      });
      res.json(enriched);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
