import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";

export class LogoutAction {
  static async handle(_req: AuthRequest, res: Response) {
    res.json({ message: "Logged out" });
  }
}
