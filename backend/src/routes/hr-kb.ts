import { Router, Response, NextFunction } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import HrQueryController from "../controllers/HrQueryController.js";
import { ListKbDocumentsAction } from "../actions/hr-kb/ListKbDocumentsAction.js";
import { GetKbDocumentAction } from "../actions/hr-kb/GetKbDocumentAction.js";
import { CreateKbDocumentAction } from "../actions/hr-kb/CreateKbDocumentAction.js";
import { UpdateKbDocumentAction } from "../actions/hr-kb/UpdateKbDocumentAction.js";
import { DeleteKbDocumentAction } from "../actions/hr-kb/DeleteKbDocumentAction.js";

function requireHr(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  if (!HrQueryController.isHR(req.user)) return res.status(403).json({ error: "HR access required" });
  next();
}

const router = Router();

router.get("/hr-kb-documents", requireAuth, requireHr, ListKbDocumentsAction.handle);
router.get("/hr-kb-documents/:id", requireAuth, requireHr, GetKbDocumentAction.handle);
router.post("/hr-kb-documents", requireAuth, requireHr, CreateKbDocumentAction.handle);
router.put("/hr-kb-documents/:id", requireAuth, requireHr, UpdateKbDocumentAction.handle);
router.delete("/hr-kb-documents/:id", requireAuth, requireHr, DeleteKbDocumentAction.handle);

export default router;
