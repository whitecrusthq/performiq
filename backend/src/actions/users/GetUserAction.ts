import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import UserController from "../../controllers/UserController.js";

export class GetUserAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result = await UserController.getById(Number(req.params.id));
      if (!result) { res.status(404).json({ error: "User not found" }); return; }
      res.json(result);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
