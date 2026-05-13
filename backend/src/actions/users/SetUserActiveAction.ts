import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import UserController from "../../controllers/UserController.js";

export class SetUserActiveAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { isActive, reason } = req.body ?? {};
      if (typeof isActive !== "boolean") {
        res.status(400).json({ error: "isActive (boolean) is required" });
        return;
      }
      const result = await UserController.setActive(
        Number(req.params.id),
        isActive,
        req.user!.id,
        req.user!.role,
        typeof reason === "string" ? reason : null
      );
      if ("error" in result) {
        res.status(result.status!).json({ error: result.error });
        return;
      }
      res.json(result.data);
    } catch (err) {
      console.error("PATCH /users/:id/active error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
