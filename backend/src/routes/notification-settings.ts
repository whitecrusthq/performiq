import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { GetPlatformsAction } from "../actions/notification-settings/GetPlatformsAction.js";
import { GetSettingsAction } from "../actions/notification-settings/GetSettingsAction.js";
import { UpdatePlatformAction } from "../actions/notification-settings/UpdatePlatformAction.js";
import { TestPlatformAction } from "../actions/notification-settings/TestPlatformAction.js";

const router = Router();

router.get("/notification-settings/platforms", requireAuth, requireRole("admin"), GetPlatformsAction.handle);
router.get("/notification-settings", requireAuth, requireRole("admin"), GetSettingsAction.handle);
router.put("/notification-settings/:platform", requireAuth, requireRole("admin"), UpdatePlatformAction.handle);
router.post("/notification-settings/:platform/test", requireAuth, requireRole("admin"), TestPlatformAction.handle);

export default router;
