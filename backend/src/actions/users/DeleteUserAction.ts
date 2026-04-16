import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import UserController from "../../controllers/UserController.js";

export class DeleteUserAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result = await UserController.delete(Number(req.params.id), req.user!.id, req.user!.role);
      if ("error" in result) {
        res.status(result.status!).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
