import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import DepartmentController from "../../controllers/DepartmentController.js";

export class ListDepartmentsAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      const result = await DepartmentController.listAll();
      res.json(result);
    } catch (err) {
      console.error("GET /departments error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
