import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import HrQueryController from "../../controllers/HrQueryController.js";

export class CreateQueryAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { title, description, category, priority } = req.body;
      if (!title?.trim() || !description?.trim()) {
        return res.status(400).json({ error: "Title and description are required" });
      }
      const result = await HrQueryController.createQuery(req.user!.id, { title, description, category, priority });
      res.status(201).json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to submit query" });
    }
  }
}
