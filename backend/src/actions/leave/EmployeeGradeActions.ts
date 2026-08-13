import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import LeaveController from "../../controllers/LeaveController.js";

export class ListGradesAction {
  static async handle(_req: AuthRequest, res: Response) {
    try {
      res.json(await LeaveController.listGrades());
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}

export class CreateGradeAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { name, description } = req.body;
      const result = await LeaveController.createGrade(name, description);
      if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
      res.status(201).json(result.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}

export class UpdateGradeAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { name, description } = req.body;
      const result = await LeaveController.updateGrade(Number(req.params.id), name, description);
      if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
      res.json(result.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}

export class DeleteGradeAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      res.json(await LeaveController.deleteGrade(Number(req.params.id)));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
