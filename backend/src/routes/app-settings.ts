import { Router } from "express";
import { requireAuth, requireAdminOrMenu } from "../middlewares/auth.js";
import { GetAppSettingsAction } from "../actions/app-settings/GetAppSettingsAction.js";
import { UpdateAppSettingsAction } from "../actions/app-settings/UpdateAppSettingsAction.js";

const router = Router();

router.get("/app-settings", GetAppSettingsAction.handle);
router.put("/app-settings", requireAuth, requireAdminOrMenu("appearance"), UpdateAppSettingsAction.handle);

export default router;
