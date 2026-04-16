import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { CreateReviewAction } from "../actions/confirmation/CreateReviewAction.js";
import { GetReviewsAction } from "../actions/confirmation/GetReviewsAction.js";
import { LinkAppraisalAction } from "../actions/confirmation/LinkAppraisalAction.js";
import { UploadDocumentAction } from "../actions/confirmation/UploadDocumentAction.js";
import { ApproveReviewAction } from "../actions/confirmation/ApproveReviewAction.js";
import { RejectReviewAction } from "../actions/confirmation/RejectReviewAction.js";
import { RefreshStatusAction } from "../actions/confirmation/RefreshStatusAction.js";

const router = Router();

router.post("/confirmation-reviews", requireAuth, requireRole("admin", "super_admin"), CreateReviewAction.handle);
router.get("/confirmation-reviews/:employeeId", requireAuth, GetReviewsAction.handle);
router.put("/confirmation-reviews/:id/link-appraisal", requireAuth, requireRole("admin", "super_admin"), LinkAppraisalAction.handle);
router.put("/confirmation-reviews/:id/document", requireAuth, requireRole("admin", "super_admin"), UploadDocumentAction.handle);
router.put("/confirmation-reviews/:id/approve", requireAuth, requireRole("admin", "super_admin"), ApproveReviewAction.handle);
router.put("/confirmation-reviews/:id/reject", requireAuth, requireRole("admin", "super_admin"), RejectReviewAction.handle);
router.put("/confirmation-reviews/:id/refresh-status", requireAuth, requireRole("admin", "super_admin"), RefreshStatusAction.handle);

export default router;
