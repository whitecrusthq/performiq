import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import UserController from "../../controllers/UserController.js";

export class BulkAssignGradeAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result = await UserController.bulkAssignGrade(req.body?.userIds, req.body?.gradeId, req.user!.role);
      if ("error" in result) {
        res.status(result.status!).json({ error: result.error });
        return;
      }
      res.json(result.data);
    } catch (err) {
      console.error("PATCH /users/bulk/grade error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}