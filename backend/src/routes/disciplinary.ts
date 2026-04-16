import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { ListRecordsAction } from "../actions/disciplinary/ListRecordsAction.js";
import { CreateRecordAction } from "../actions/disciplinary/CreateRecordAction.js";
import { UpdateRecordAction } from "../actions/disciplinary/UpdateRecordAction.js";
import { DeleteRecordAction } from "../actions/disciplinary/DeleteRecordAction.js";
import { AddAttachmentAction } from "../actions/disciplinary/AddAttachmentAction.js";
import { DeleteAttachmentAction } from "../actions/disciplinary/DeleteAttachmentAction.js";

const router = Router();

router.get("/users/:userId/disciplinary", requireAuth, requireRole(["admin", "super_admin"]), ListRecordsAction.handle);
router.post("/users/:userId/disciplinary", requireAuth, requireRole(["admin", "super_admin"]), CreateRecordAction.handle);
router.put("/users/:userId/disciplinary/:id", requireAuth, requireRole(["admin", "super_admin"]), UpdateRecordAction.handle);
router.delete("/users/:userId/disciplinary/:id", requireAuth, requireRole(["admin", "super_admin"]), DeleteRecordAction.handle);
router.post("/users/:userId/disciplinary/:id/attachments", requireAuth, requireRole(["admin", "super_admin"]), AddAttachmentAction.handle);
router.delete("/users/:userId/disciplinary/:recordId/attachments/:attachmentId", requireAuth, requireRole(["admin", "super_admin"]), DeleteAttachmentAction.handle);

export default router;
