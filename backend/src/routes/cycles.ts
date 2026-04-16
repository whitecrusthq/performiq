import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { ListCyclesAction } from "../actions/cycles/ListCyclesAction.js";
import { CreateCycleAction } from "../actions/cycles/CreateCycleAction.js";
import { GetCycleAction } from "../actions/cycles/GetCycleAction.js";
import { UpdateCycleAction } from "../actions/cycles/UpdateCycleAction.js";
import { DeleteCycleAction } from "../actions/cycles/DeleteCycleAction.js";

const router = Router();

router.get("/cycles", requireAuth, ListCyclesAction.handle);
router.post("/cycles", requireAuth, requireRole("admin"), CreateCycleAction.handle);
router.get("/cycles/:id", requireAuth, GetCycleAction.handle);
router.put("/cycles/:id", requireAuth, requireRole("admin"), UpdateCycleAction.handle);
router.delete("/cycles/:id", requireAuth, requireRole("admin"), DeleteCycleAction.handle);

export default router;
