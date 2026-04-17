import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { GetReportsAction } from "../actions/reports/GetReportsAction.js";
import { GetAttendanceSummaryAction } from "../actions/reports/GetAttendanceSummaryAction.js";
import { GetTimesheetsSummaryAction } from "../actions/reports/GetTimesheetsSummaryAction.js";
import { GetLeaveSummaryAction } from "../actions/reports/GetLeaveSummaryAction.js";

const router = Router();

router.get("/reports", requireAuth, requireRole("admin"), GetReportsAction.handle);
router.get("/reports/attendance-summary", requireAuth, requireRole("admin"), GetAttendanceSummaryAction.handle);
router.get("/reports/timesheets-summary", requireAuth, requireRole("admin"), GetTimesheetsSummaryAction.handle);
router.get("/reports/leave-summary", requireAuth, requireRole("admin"), GetLeaveSummaryAction.handle);

export default router;
