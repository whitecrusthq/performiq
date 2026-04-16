import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import DepartmentController from "../../controllers/DepartmentController.js";

export class DeleteDepartmentAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id as string);
      const result = await DepartmentController.delete(id);
      if (!result) { res.status(404).json({ error: "Department not found" }); return; }
      res.json({ success: true });
    } catch (err) {
      console.error("DELETE /departments/:id error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
