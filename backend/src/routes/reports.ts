import { Router } from "express";
import { requireAuth, requireAdminOrMenu } from "../middlewares/auth.js";
import { GetReportsAction } from "../actions/reports/GetReportsAction.js";
import { GetAttendanceSummaryAction } from "../actions/reports/GetAttendanceSummaryAction.js";
import { GetTimesheetsSummaryAction } from "../actions/reports/GetTimesheetsSummaryAction.js";
import { GetLeaveSummaryAction } from "../actions/reports/GetLeaveSummaryAction.js";

const router = Router();

router.get("/reports", requireAuth, requireAdminOrMenu("reports"), GetReportsAction.handle);
router.get("/reports/attendance-summary", requireAuth, requireAdminOrMenu("reports"), GetAttendanceSummaryAction.handle);
router.get("/reports/timesheets-summary", requireAuth, requireAdminOrMenu("reports"), GetTimesheetsSummaryAction.handle);
router.get("/reports/leave-summary", requireAuth, requireAdminOrMenu("reports"), GetLeaveSummaryAction.handle);

export default router;
