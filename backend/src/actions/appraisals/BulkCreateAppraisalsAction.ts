import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AppraisalController from "../../controllers/AppraisalController.js";

export class BulkCreateAppraisalsAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      if (!["admin", "super_admin", "manager"].includes(req.user!.role)) {
        res.status(403).json({ error: "Forbidden" }); return;
      }
      const { cycleId, employeeIds, reviewerIds, workflowType, criteriaGroupId, budgetsByCategory } = req.body;
      if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
        res.status(400).json({ error: "employeeIds must be a non-empty array" }); return;
      }

      const orderedReviewerIds: number[] = Array.isArray(reviewerIds) && reviewerIds.length > 0
        ? reviewerIds.map(Number)
        : (req.user!.role !== "employee" ? [req.user!.id] : []);

      const result = await AppraisalController.bulkCreate({
        cycleId, employeeIds, reviewerIds: orderedReviewerIds,
        workflowType: workflowType ?? "admin_approval",
        criteriaGroupId: criteriaGroupId ? Number(criteriaGroupId) : null,
        budgetsByCategory,
        currentUser: req.user!,
      });
      res.status(201).json(result);
    } catch (err: any) {
      console.error(err);
      if (err.message === "No valid employee IDs provided") {
        res.status(400).json({ error: err.message }); return;
      }
      if (err.message?.startsWith("FORBIDDEN:")) {
        res.status(403).json({ error: err.message.slice(10) }); return;
      }
      res.status(500).json({ error: "Server error" });
    }
  }
}
