import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import UserController from "../../controllers/UserController.js";

export class CreateDocumentAction {
  static async handle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { role, id: actorId } = req.user!;
      const targetId = Number(req.params.id);
      if (role === "employee" && actorId !== targetId) { res.status(403).json({ error: "Forbidden" }); return; }
      const { name } = req.body;
      if (!name?.trim()) { res.status(400).json({ error: "Document name is required" }); return; }
      const doc = await UserController.createDocument(targetId, actorId, req.body);
      res.status(201).json(doc);
    } catch (err) {
      console.error("POST /users/:id/documents error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
