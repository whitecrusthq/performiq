import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import UserController from "../../controllers/UserController.js";

export class DeleteDocumentAction {
  static async handle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { role, id: actorId } = req.user!;
      const targetId = Number(req.params.id);
      if (role === "employee" && actorId !== targetId) { res.status(403).json({ error: "Forbidden" }); return; }
      await UserController.deleteDocument(Number(req.params.docId));
      res.json({ message: "Document deleted" });
    } catch (err) {
      console.error("DELETE /users/:id/documents/:docId error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
