import { Router } from "express";
import { requireAuth, requireHRAccess } from "../middlewares/auth.js";
import { ListTemplatesAction } from "../actions/onboarding/ListTemplatesAction.js";
import { CreateTemplateAction } from "../actions/onboarding/CreateTemplateAction.js";
import { UpdateTemplateAction } from "../actions/onboarding/UpdateTemplateAction.js";
import { DeleteTemplateAction } from "../actions/onboarding/DeleteTemplateAction.js";
import { ListWorkflowsAction } from "../actions/onboarding/ListWorkflowsAction.js";
import { CreateWorkflowAction } from "../actions/onboarding/CreateWorkflowAction.js";
import { GetWorkflowAction } from "../actions/onboarding/GetWorkflowAction.js";
import { UpdateWorkflowAction } from "../actions/onboarding/UpdateWorkflowAction.js";
import { DeleteWorkflowAction } from "../actions/onboarding/DeleteWorkflowAction.js";
import { UpdateTaskAction } from "../actions/onboarding/UpdateTaskAction.js";
import { AddWorkflowTaskAction } from "../actions/onboarding/AddWorkflowTaskAction.js";
import { DeleteTaskAction } from "../actions/onboarding/DeleteTaskAction.js";
import { ListDocumentsAction } from "../actions/onboarding/ListDocumentsAction.js";
import { DownloadDocumentAction } from "../actions/onboarding/DownloadDocumentAction.js";
import { CreateDocumentAction } from "../actions/onboarding/CreateDocumentAction.js";
import { DeleteDocumentAction } from "../actions/onboarding/DeleteDocumentAction.js";
import { UpdateProbationAction } from "../actions/onboarding/UpdateProbationAction.js";

const router = Router();

router.get("/onboarding/templates", requireAuth, ListTemplatesAction.handle);
router.post("/onboarding/templates", requireAuth, requireHRAccess, CreateTemplateAction.handle);
router.put("/onboarding/templates/:id", requireAuth, requireHRAccess, UpdateTemplateAction.handle);
router.delete("/onboarding/templates/:id", requireAuth, requireHRAccess, DeleteTemplateAction.handle);

router.get("/onboarding/workflows", requireAuth, ListWorkflowsAction.handle);
router.post("/onboarding/workflows", requireAuth, requireHRAccess, CreateWorkflowAction.handle);
router.get("/onboarding/workflows/:id", requireAuth, GetWorkflowAction.handle);
router.put("/onboarding/workflows/:id", requireAuth, requireHRAccess, UpdateWorkflowAction.handle);
router.delete("/onboarding/workflows/:id", requireAuth, requireHRAccess, DeleteWorkflowAction.handle);

router.patch("/onboarding/tasks/:id", requireAuth, UpdateTaskAction.handle);
router.post("/onboarding/workflows/:id/tasks", requireAuth, requireHRAccess, AddWorkflowTaskAction.handle);
router.delete("/onboarding/tasks/:id", requireAuth, requireHRAccess, DeleteTaskAction.handle);

router.get("/onboarding/workflows/:id/documents", requireAuth, ListDocumentsAction.handle);
router.get("/onboarding/documents/:docId/download", requireAuth, DownloadDocumentAction.handle);
router.post("/onboarding/workflows/:id/documents", requireAuth, CreateDocumentAction.handle);
router.delete("/onboarding/documents/:docId", requireAuth, requireHRAccess, DeleteDocumentAction.handle);

router.put("/onboarding/probation/:userId", requireAuth, requireHRAccess, UpdateProbationAction.handle);

export default router;
