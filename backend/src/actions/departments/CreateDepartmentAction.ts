import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import DepartmentController from "../../controllers/DepartmentController.js";

export class CreateDepartmentAction {
  static async handle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { name, description } = req.body;
      if (!name?.trim()) { res.status(400).json({ error: "Department name is required" }); return; }
      const created = await DepartmentController.create(name, description);
      res.status(201).json(created);
    } catch (err: any) {
      if (err.name === "SequelizeUniqueConstraintError" || err.original?.code === "23505") { res.status(409).json({ error: "A department with that name already exists" }); return; }
      console.error("POST /departments error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
