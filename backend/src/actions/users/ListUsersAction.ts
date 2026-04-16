import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import UserController from "../../controllers/UserController.js";

export class ListUsersAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const users = await UserController.getAll(req.user!.role);
      res.json(users);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
