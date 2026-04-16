import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import DepartmentController from "../../controllers/DepartmentController.js";

export class UpdateDepartmentAction {
  static async handle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id as string);
      const { name, description } = req.body;
      if (!name?.trim()) { res.status(400).json({ error: "Department name is required" }); return; }
      const updated = await DepartmentController.update(id, name, description);
      if (!updated) { res.status(404).json({ error: "Department not found" }); return; }
      res.json(updated);
    } catch (err: any) {
      if (err.name === "SequelizeUniqueConstraintError" || err.original?.code === "23505") { res.status(409).json({ error: "A department with that name already exists" }); return; }
      console.error("PUT /departments/:id error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
