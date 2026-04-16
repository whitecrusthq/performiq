import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { ListTimesheetApproversAction } from "../actions/timesheets/ListTimesheetApproversAction.js";
import { ListTimesheetsAction } from "../actions/timesheets/ListTimesheetsAction.js";
import { GetCurrentTimesheetAction } from "../actions/timesheets/GetCurrentTimesheetAction.js";
import { GetWeekTimesheetAction } from "../actions/timesheets/GetWeekTimesheetAction.js";
import { GetTimesheetAction } from "../actions/timesheets/GetTimesheetAction.js";
import { UpsertTimesheetEntryAction } from "../actions/timesheets/UpsertTimesheetEntryAction.js";
import { SubmitTimesheetAction } from "../actions/timesheets/SubmitTimesheetAction.js";
import { ApproveTimesheetAction } from "../actions/timesheets/ApproveTimesheetAction.js";
import { RejectTimesheetAction } from "../actions/timesheets/RejectTimesheetAction.js";

const router = Router();

router.get("/timesheets/approvers", requireAuth, ListTimesheetApproversAction.handle);
router.get("/timesheets", requireAuth, ListTimesheetsAction.handle);
router.get("/timesheets/current", requireAuth, GetCurrentTimesheetAction.handle);
router.get("/timesheets/week", requireAuth, GetWeekTimesheetAction.handle);
router.get("/timesheets/:id", requireAuth, GetTimesheetAction.handle);
router.put("/timesheets/:id/entries", requireAuth, UpsertTimesheetEntryAction.handle);
router.post("/timesheets/:id/submit", requireAuth, SubmitTimesheetAction.handle);
router.post("/timesheets/:id/approve", requireAuth, ApproveTimesheetAction.handle);
router.post("/timesheets/:id/reject", requireAuth, RejectTimesheetAction.handle);

export default router;
