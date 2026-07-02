import { Router } from "express";
import { SweepAction } from "../actions/cron/SweepAction.js";

const router = Router();

// Authenticated via SWEEP_SECRET inside the action (not requireAuth), so an
// external scheduler with no user session can trigger it. GET is allowed too so
// simple cron/uptime services that only issue GET requests can call it.
router.post("/cron/sweep", SweepAction.handle);
router.get("/cron/sweep", SweepAction.handle);

export default router;
