import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import UserController from "../../controllers/UserController.js";

export class CreateUserAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const result = await UserController.create(req.body, req.user!.role);
      if ("error" in result) {
        res.status(result.status!).json({ error: result.error });
        return;
      }
      res.status(result.status!).json(result.data);
    } catch (err: any) {
      if (err.original?.code === "23505") res.status(409).json({ error: "Email already exists" });
      else res.status(500).json({ error: "Server error" });
    }
  }
}
