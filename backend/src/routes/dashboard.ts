import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { GetDashboardAction } from "../actions/dashboard/GetDashboardAction.js";

const router = Router();

router.get("/dashboard", requireAuth, GetDashboardAction.handle);

export default router;
