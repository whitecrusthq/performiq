import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AppraisalController from "../../controllers/AppraisalController.js";

export class CreateAppraisalAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      if (!["admin", "super_admin", "manager"].includes(req.user!.role)) {
        res.status(403).json({ error: "Forbidden" }); return;
      }
      const { cycleId, employeeId, reviewerIds, workflowType, criteriaGroupId, budgetValues } = req.body;
      const orderedIds: number[] = Array.isArray(reviewerIds) && reviewerIds.length > 0
        ? reviewerIds.map(Number)
        : (req.user!.role !== "employee" ? [req.user!.id] : []);

      const budgetMap: Record<number, number> = {};
      if (budgetValues && typeof budgetValues === 'object') {
        for (const [k, v] of Object.entries(budgetValues)) {
          budgetMap[Number(k)] = Number(v);
        }
      }

      const enriched = await AppraisalController.create({
        cycleId, employeeId, reviewerIds: orderedIds,
        workflowType: workflowType ?? "admin_approval",
        criteriaGroupId: criteriaGroupId ? Number(criteriaGroupId) : null,
        budgetValues: budgetMap,
      });
      res.status(201).json(enriched);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
