import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AppraisalController from "../../controllers/AppraisalController.js";
import { Appraisal, AppraisalReviewer, User } from "../../models/index.js";

export class UpdateAppraisalAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const appraisalId = Number(req.params.id);
      const current = await Appraisal.findByPk(appraisalId);
      if (!current) { res.status(404).json({ error: "Not found" }); return; }

      const currentPlain = (current as any).get({ plain: true });
      const putUserId = req.user!.id;
      const putUserRole = req.user!.role;
      if (putUserRole === "employee" && currentPlain.employeeId !== putUserId) {
        res.status(403).json({ error: "You can only update your own appraisals" }); return;
      }
      if (putUserRole === "manager") {
        const isOwner = currentPlain.employeeId === putUserId;
        const isReviewerCheck = await AppraisalReviewer.findOne({
          where: { appraisalId, reviewerId: putUserId },
        });
        const teamMembersCheck = await User.findAll({ where: { managerId: putUserId }, attributes: ["id"] });
        const isTeamMgr = teamMembersCheck.some((m: any) => m.id === currentPlain.employeeId);
        if (!isOwner && !isReviewerCheck && !isTeamMgr) {
          res.status(403).json({ error: "You can only update appraisals for your team or reviews assigned to you" }); return;
        }
      }

      const result = await AppraisalController.update(appraisalId, req.body, req.user!);
      if (result.error) {
        res.status(result.status!).json({ error: result.error }); return;
      }
      res.json(result.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
