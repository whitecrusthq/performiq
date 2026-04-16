import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import AttendanceController from "../../controllers/AttendanceController.js";

export class FaceReviewAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { role, id: reviewerId } = req.user!;
      if (role === "employee") { res.status(403).json({ error: "Forbidden" }); return; }
      const logId = parseInt(req.params.id as string);
      const { status } = req.body as { status: "verified" | "flagged" | "pending" };
      if (!["verified", "flagged", "pending"].includes(status)) {
        res.status(400).json({ error: "Invalid status. Use verified, flagged or pending." }); return;
      }
      const updated = await AttendanceController.faceReview(logId, reviewerId, status);
      if (!updated) { res.status(404).json({ error: "Log not found" }); return; }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: "Failed to update face review status" });
    }
  }
}
