import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { LoginAction } from "../actions/auth/LoginAction.js";
import { VerifyOtpAction } from "../actions/auth/VerifyOtpAction.js";
import { LogoutAction } from "../actions/auth/LogoutAction.js";
import { ChangePasswordAction } from "../actions/auth/ChangePasswordAction.js";
import { GetMeAction } from "../actions/auth/GetMeAction.js";

const router = Router();

router.post("/auth/login", LoginAction.handle);
router.post("/auth/verify-otp", VerifyOtpAction.handle);
router.post("/auth/logout", LogoutAction.handle);
router.post("/auth/change-password", requireAuth, ChangePasswordAction.handle);
router.get("/auth/me", requireAuth, GetMeAction.handle);

export default router;
