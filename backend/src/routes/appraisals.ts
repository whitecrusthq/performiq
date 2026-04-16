import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { ListAppraisalsAction } from "../actions/appraisals/ListAppraisalsAction.js";
import { CreateAppraisalAction } from "../actions/appraisals/CreateAppraisalAction.js";
import { BulkCreateAppraisalsAction } from "../actions/appraisals/BulkCreateAppraisalsAction.js";
import { GetAppraisalAction } from "../actions/appraisals/GetAppraisalAction.js";
import { UpdateAppraisalAction } from "../actions/appraisals/UpdateAppraisalAction.js";
import { AddReviewerAction } from "../actions/appraisals/AddReviewerAction.js";
import { DeleteAppraisalAction } from "../actions/appraisals/DeleteAppraisalAction.js";
import { RemoveReviewerAction } from "../actions/appraisals/RemoveReviewerAction.js";

const router = Router();

router.get("/appraisals", requireAuth, ListAppraisalsAction.handle);
router.post("/appraisals", requireAuth, CreateAppraisalAction.handle);
router.post("/appraisals/bulk", requireAuth, BulkCreateAppraisalsAction.handle);
router.get("/appraisals/:id", requireAuth, GetAppraisalAction.handle);
router.put("/appraisals/:id", requireAuth, UpdateAppraisalAction.handle);
router.post("/appraisals/:id/reviewers", requireAuth, requireRole("admin"), AddReviewerAction.handle);
router.delete("/appraisals/:id", requireAuth, requireRole("admin"), DeleteAppraisalAction.handle);
router.delete("/appraisals/:id/reviewers/:reviewerId", requireAuth, requireRole("admin"), RemoveReviewerAction.handle);

export default router;
