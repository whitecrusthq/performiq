import { Router } from "express";
import { requireAuth, requireRole, requireAuditLogAccess, requireAccountLockManagementAccess } from "../middlewares/auth.js";
import SecurityController from "../controllers/SecurityController.js";
import { GetSecuritySettingsAction } from "../actions/security/GetSecuritySettingsAction.js";
import { GetSessionConfigAction } from "../actions/security/GetSessionConfigAction.js";
import { UpdateSecuritySettingsAction } from "../actions/security/UpdateSecuritySettingsAction.js";
import { GetLockedAccountsAction } from "../actions/security/GetLockedAccountsAction.js";
import { UnlockAccountAction } from "../actions/security/UnlockAccountAction.js";
import { GetAuthAuditLogsAction } from "../actions/security/GetAuthAuditLogsAction.js";
import { BulkUnlockAccountsAction } from "../actions/security/BulkUnlockAccountsAction.js";

const router = Router();

router.get("/security/settings", requireAuth, requireRole("admin"), GetSecuritySettingsAction.handle);
router.get("/security/session-config", requireAuth, GetSessionConfigAction.handle);
router.put("/security/settings", requireAuth, requireRole("admin"), UpdateSecuritySettingsAction.handle);
router.get("/security/locked-accounts", requireAuth, requireAccountLockManagementAccess, GetLockedAccountsAction.handle);
router.put("/security/unlock", requireAuth, requireAccountLockManagementAccess, BulkUnlockAccountsAction.handle);
router.put("/security/unlock/:id", requireAuth, requireAccountLockManagementAccess, UnlockAccountAction.handle);
router.get("/security/audit-logs", requireAuth, requireAuditLogAccess, GetAuthAuditLogsAction.handle);

const getSettings = SecurityController.getSettings.bind(SecurityController);
export { getSettings };
export default router;
