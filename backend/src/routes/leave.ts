import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { ListLeaveTypesAction } from "../actions/leave/ListLeaveTypesAction.js";
import { CreateLeaveTypeAction } from "../actions/leave/CreateLeaveTypeAction.js";
import { UpdateLeaveTypeAction } from "../actions/leave/UpdateLeaveTypeAction.js";
import { DeleteLeaveTypeAction } from "../actions/leave/DeleteLeaveTypeAction.js";
import { ListLeavePoliciesAction } from "../actions/leave/ListLeavePoliciesAction.js";
import { UpsertLeavePolicyAction } from "../actions/leave/UpsertLeavePolicyAction.js";
import { DeleteLeavePolicyAction } from "../actions/leave/DeleteLeavePolicyAction.js";
import { GetLeaveBalanceAction } from "../actions/leave/GetLeaveBalanceAction.js";
import { GetTeamLeaveBalanceAction } from "../actions/leave/GetTeamLeaveBalanceAction.js";
import { ListLeaveRequestsAction } from "../actions/leave/ListLeaveRequestsAction.js";
import { CreateLeaveRequestAction } from "../actions/leave/CreateLeaveRequestAction.js";
import { GetLeaveRequestAction } from "../actions/leave/GetLeaveRequestAction.js";
import { UpdateLeaveRequestAction } from "../actions/leave/UpdateLeaveRequestAction.js";
import { DeleteLeaveRequestAction } from "../actions/leave/DeleteLeaveRequestAction.js";
import { RespondCoverAction } from "../actions/leave/RespondCoverAction.js";
import { ListGradesAction, CreateGradeAction, UpdateGradeAction, DeleteGradeAction } from "../actions/leave/EmployeeGradeActions.js";
import { GetHrApproverAction, SetHrApproverAction } from "../actions/leave/HrApproverSettingActions.js";
import { AdjustLeaveAllocationAction } from "../actions/leave/AdjustLeaveAllocationAction.js";

const router = Router();

router.put("/leave-allocations", requireAuth, requireRole("admin"), AdjustLeaveAllocationAction.handle);

router.get("/leave-hr-approver", requireAuth, GetHrApproverAction.handle);
router.put("/leave-hr-approver", requireAuth, requireRole("admin"), SetHrApproverAction.handle);

router.get("/grades", requireAuth, ListGradesAction.handle);
router.post("/grades", requireAuth, requireRole("admin"), CreateGradeAction.handle);
router.put("/grades/:id", requireAuth, requireRole("admin"), UpdateGradeAction.handle);
router.delete("/grades/:id", requireAuth, requireRole("admin"), DeleteGradeAction.handle);

router.get("/leave-types", requireAuth, ListLeaveTypesAction.handle);
router.post("/leave-types", requireAuth, requireRole("admin"), CreateLeaveTypeAction.handle);
router.put("/leave-types/:id", requireAuth, requireRole("admin"), UpdateLeaveTypeAction.handle);
router.delete("/leave-types/:id", requireAuth, requireRole("admin"), DeleteLeaveTypeAction.handle);

router.get("/leave-policies", requireAuth, ListLeavePoliciesAction.handle);
router.post("/leave-policies", requireAuth, requireRole("admin"), UpsertLeavePolicyAction.handle);
router.delete("/leave-policies/:id", requireAuth, requireRole("admin"), DeleteLeavePolicyAction.handle);

router.get("/leave-balance", requireAuth, GetLeaveBalanceAction.handle);
router.get("/leave-balance/team", requireAuth, GetTeamLeaveBalanceAction.handle);

router.get("/leave-requests", requireAuth, ListLeaveRequestsAction.handle);
router.post("/leave-requests", requireAuth, CreateLeaveRequestAction.handle);
router.get("/leave-requests/:id", requireAuth, GetLeaveRequestAction.handle);
router.put("/leave-requests/:id", requireAuth, UpdateLeaveRequestAction.handle);
router.post("/leave-requests/:id/cover-response", requireAuth, RespondCoverAction.handle);
router.delete("/leave-requests/:id", requireAuth, requireRole("admin"), DeleteLeaveRequestAction.handle);

export default router;
