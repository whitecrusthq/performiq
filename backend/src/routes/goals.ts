import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { ListGoalsAction } from "../actions/goals/ListGoalsAction.js";
import { CreateGoalAction } from "../actions/goals/CreateGoalAction.js";
import { UpdateGoalAction } from "../actions/goals/UpdateGoalAction.js";
import { DeleteGoalAction } from "../actions/goals/DeleteGoalAction.js";

const router = Router();

router.get("/goals", requireAuth, ListGoalsAction.handle);
router.post("/goals", requireAuth, CreateGoalAction.handle);
router.put("/goals/:id", requireAuth, UpdateGoalAction.handle);
router.delete("/goals/:id", requireAuth, DeleteGoalAction.handle);

export default router;
