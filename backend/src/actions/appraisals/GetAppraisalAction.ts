import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AppraisalController from "../../controllers/AppraisalController.js";
import { Appraisal, AppraisalReviewer, User } from "../../models/index.js";

export class GetAppraisalAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const appraisal = await Appraisal.findByPk(Number(req.params.id));
      if (!appraisal) { res.status(404).json({ error: "Not found" }); return; }

      const plain = (appraisal as any).get({ plain: true });
      const userId = req.user!.id;
      const userRole = req.user!.role;
      if (userRole === "employee" && plain.employeeId !== userId) {
        res.status(403).json({ error: "You can only view your own appraisals" }); return;
      }
      if (userRole === "manager") {
        const isOwner = plain.employeeId === userId;
        const isReviewer = await AppraisalReviewer.findOne({
          where: { appraisalId: plain.id, reviewerId: userId },
        });
        const teamMembers = await User.findAll({ where: { managerId: userId }, attributes: ["id"] });
        const isTeamManager = teamMembers.some((m: any) => m.id === plain.employeeId);
        if (!isOwner && !isReviewer && !isTeamManager) {
          res.status(403).json({ error: "You can only view appraisals for your team or reviews assigned to you" }); return;
        }
      }

      const result = await AppraisalController.getById(Number(req.params.id));
      if (!result) { res.status(404).json({ error: "Not found" }); return; }
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
