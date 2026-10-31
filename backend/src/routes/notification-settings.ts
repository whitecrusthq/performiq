import { Router } from "express";
import { requireAuth, requireCurrentAdmin, requireCurrentSuperAdmin } from "../middlewares/auth.js";
import { GetPlatformsAction } from "../actions/notification-settings/GetPlatformsAction.js";
import { GetSettingsAction } from "../actions/notification-settings/GetSettingsAction.js";
import { UpdatePlatformAction } from "../actions/notification-settings/UpdatePlatformAction.js";
import { TestPlatformAction } from "../actions/notification-settings/TestPlatformAction.js";
import { AdministrativeRecipientsAction } from "../actions/notification-settings/AdministrativeRecipientsAction.js";

const router = Router();

router.get("/notification-settings/platforms", requireAuth, requireCurrentAdmin, GetPlatformsAction.handle);
router.get("/notification-settings", requireAuth, requireCurrentAdmin, GetSettingsAction.handle);
router.put("/notification-settings/:platform", requireAuth, requireCurrentAdmin, UpdatePlatformAction.handle);
router.post("/notification-settings/:platform/test", requireAuth, requireCurrentAdmin, TestPlatformAction.handle);
router.get("/notification-settings/admin-recipients/list", requireAuth, requireCurrentSuperAdmin, AdministrativeRecipientsAction.list);
router.put("/notification-settings/admin-recipients/list", requireAuth, requireCurrentSuperAdmin, AdministrativeRecipientsAction.update);

export default router;
