import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { LoginAction } from "../actions/auth/LoginAction.js";
import { VerifyOtpAction } from "../actions/auth/VerifyOtpAction.js";
import { LogoutAction } from "../actions/auth/LogoutAction.js";
import { ChangePasswordAction } from "../actions/auth/ChangePasswordAction.js";
import { GetMeAction } from "../actions/auth/GetMeAction.js";
import { Setup2FAAction } from "../actions/auth/Setup2FAAction.js";
import { Enable2FAAction } from "../actions/auth/Enable2FAAction.js";
import { Disable2FAAction } from "../actions/auth/Disable2FAAction.js";
import { Verify2FAAction } from "../actions/auth/Verify2FAAction.js";
import { Regenerate2FABackupCodesAction } from "../actions/auth/Regenerate2FABackupCodesAction.js";
import { ForcedSetup2FAAction } from "../actions/auth/ForcedSetup2FAAction.js";
import { ForcedEnable2FAAction } from "../actions/auth/ForcedEnable2FAAction.js";

const router = Router();

router.post("/auth/login", LoginAction.handle);
router.post("/auth/verify-otp", VerifyOtpAction.handle);
router.post("/auth/logout", LogoutAction.handle);
router.post("/auth/change-password", requireAuth, ChangePasswordAction.handle);
router.get("/auth/me", requireAuth, GetMeAction.handle);

router.post("/auth/2fa/verify", Verify2FAAction.handle);
router.post("/auth/2fa/forced-setup", ForcedSetup2FAAction.handle);
router.post("/auth/2fa/forced-enable", ForcedEnable2FAAction.handle);
router.post("/auth/2fa/setup", requireAuth, Setup2FAAction.handle);
router.post("/auth/2fa/enable", requireAuth, Enable2FAAction.handle);
router.post("/auth/2fa/disable", requireAuth, Disable2FAAction.handle);
router.post("/auth/2fa/backup-codes", requireAuth, Regenerate2FABackupCodesAction.handle);

export default router;
