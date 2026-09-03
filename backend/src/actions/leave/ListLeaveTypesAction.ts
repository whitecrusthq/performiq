import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import LeaveController from "../../controllers/LeaveController.js";

export class ListLeaveTypesAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      // Employee-facing lists are always filtered server-side. Admins retain the
      // full list for leave-type configuration unless they explicitly request
      // their own eligible types.
      const isAdmin = req.user?.role === "admin" || req.user?.role === "super_admin";
      const forMe = req.user && (!isAdmin || req.query.forMe === "1") ? req.user.id : undefined;
      const types = await LeaveController.listLeaveTypes(forMe);
      res.json(types);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
