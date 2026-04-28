import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import LeaveController from "../../controllers/LeaveController.js";

export class RespondCoverAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { decision, note } = req.body as { decision: "agreed" | "declined"; note?: string };
      const result = await LeaveController.respondToCover(
        Number(req.params.id),
        req.user!.id,
        decision,
        note
      );
      if ("error" in result && !("data" in result)) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json(result.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
