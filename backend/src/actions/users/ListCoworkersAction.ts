import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import User from "../../models/User.js";

export class ListCoworkersAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const users = await User.findAll({
        attributes: ["id", "name", "role", "department", "jobTitle"],
        where: { isLocked: false },
        order: [["name", "ASC"]],
      });
      res.json(users.map(u => ({
        id: u.id,
        name: u.name,
        role: u.role,
        department: u.department,
        jobTitle: u.jobTitle,
      })));
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
}
