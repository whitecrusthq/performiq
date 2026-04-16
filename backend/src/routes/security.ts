import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import SecurityController from "../controllers/SecurityController.js";
import { GetSecuritySettingsAction } from "../actions/security/GetSecuritySettingsAction.js";
import { UpdateSecuritySettingsAction } from "../actions/security/UpdateSecuritySettingsAction.js";
import { GetLockedAccountsAction } from "../actions/security/GetLockedAccountsAction.js";
import { UnlockAccountAction } from "../actions/security/UnlockAccountAction.js";

const router = Router();

router.get("/security/settings", requireAuth, requireRole("admin"), GetSecuritySettingsAction.handle);
router.put("/security/settings", requireAuth, requireRole("admin"), UpdateSecuritySettingsAction.handle);
router.get("/security/locked-accounts", requireAuth, requireRole("admin"), GetLockedAccountsAction.handle);
router.put("/security/unlock/:id", requireAuth, requireRole("admin"), UnlockAccountAction.handle);

const getSettings = SecurityController.getSettings.bind(SecurityController);
export { getSettings };
export default router;
