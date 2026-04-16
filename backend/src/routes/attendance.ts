import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { GetTodayStatusAction } from "../actions/attendance/GetTodayStatusAction.js";
import { ClockInAction } from "../actions/attendance/ClockInAction.js";
import { ClockOutAction } from "../actions/attendance/ClockOutAction.js";
import { ListAttendanceLogsAction } from "../actions/attendance/ListAttendanceLogsAction.js";
import { LocationPingAction } from "../actions/attendance/LocationPingAction.js";
import { BatchLocationPingAction } from "../actions/attendance/BatchLocationPingAction.js";
import { FaceReviewAction } from "../actions/attendance/FaceReviewAction.js";
import { GetPingsAction } from "../actions/attendance/GetPingsAction.js";

const router = Router();

router.get("/attendance/today", requireAuth, GetTodayStatusAction.handle);
router.post("/attendance/clock-in", requireAuth, ClockInAction.handle);
router.post("/attendance/clock-out", requireAuth, ClockOutAction.handle);
router.get("/attendance", requireAuth, ListAttendanceLogsAction.handle);
router.post("/attendance/location-ping", requireAuth, LocationPingAction.handle);
router.post("/attendance/location-ping/batch", requireAuth, BatchLocationPingAction.handle);
router.put("/attendance/:id/face-review", requireAuth, FaceReviewAction.handle);
router.get("/attendance/:id/pings", requireAuth, GetPingsAction.handle);

export default router;
