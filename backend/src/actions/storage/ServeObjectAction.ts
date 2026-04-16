import { Request, Response } from "express";
import StorageController from "../../controllers/StorageController.js";

export class ServeObjectAction {
  static async handle(req: Request, res: Response) {
    try {
      await StorageController.serve(req.params.objectId, res);
    } catch (err: any) {
      console.error("Storage serve error:", err);
      res.status(500).json({ error: "Failed to serve file" });
    }
  }
}
