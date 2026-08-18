import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import UserController from "../../controllers/UserController.js";

export class SetUserProtectedAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result = await UserController.setProtected(Number(req.params.id), req.body?.isProtected === true);
      if ("error" in result) {
        res.status(result.status!).json({ error: result.error });
        return;
      }
      res.json(result.data);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
