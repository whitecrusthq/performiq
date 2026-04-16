import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { ListJobsAction } from "../actions/recruitment/ListJobsAction.js";
import { CreateJobAction } from "../actions/recruitment/CreateJobAction.js";
import { UpdateJobAction } from "../actions/recruitment/UpdateJobAction.js";
import { DeleteJobAction } from "../actions/recruitment/DeleteJobAction.js";
import { ListCandidatesAction } from "../actions/recruitment/ListCandidatesAction.js";
import { CreateCandidateAction } from "../actions/recruitment/CreateCandidateAction.js";
import { UpdateCandidateAction } from "../actions/recruitment/UpdateCandidateAction.js";
import { DeleteCandidateAction } from "../actions/recruitment/DeleteCandidateAction.js";
import { HireCandidateAction } from "../actions/recruitment/HireCandidateAction.js";

const router = Router();

router.get("/recruitment/jobs", requireAuth, requireRole("admin", "manager"), ListJobsAction.handle);
router.post("/recruitment/jobs", requireAuth, requireRole("admin"), CreateJobAction.handle);
router.put("/recruitment/jobs/:id", requireAuth, requireRole("admin"), UpdateJobAction.handle);
router.delete("/recruitment/jobs/:id", requireAuth, requireRole("admin"), DeleteJobAction.handle);
router.get("/recruitment/jobs/:jobId/candidates", requireAuth, requireRole("admin", "manager"), ListCandidatesAction.handle);
router.post("/recruitment/jobs/:jobId/candidates", requireAuth, requireRole("admin", "manager"), CreateCandidateAction.handle);
router.put("/recruitment/candidates/:id", requireAuth, requireRole("admin", "manager"), UpdateCandidateAction.handle);
router.delete("/recruitment/candidates/:id", requireAuth, requireRole("admin"), DeleteCandidateAction.handle);
router.post("/recruitment/candidates/:id/hire", requireAuth, requireRole("admin"), HireCandidateAction.handle);

export default router;
