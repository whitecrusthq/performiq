import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { GetAppSettingsAction } from "../actions/app-settings/GetAppSettingsAction.js";
import { UpdateAppSettingsAction } from "../actions/app-settings/UpdateAppSettingsAction.js";

const router = Router();

router.get("/app-settings", GetAppSettingsAction.handle);
router.put("/app-settings", requireAuth, requireRole("admin"), UpdateAppSettingsAction.handle);

export default router;
