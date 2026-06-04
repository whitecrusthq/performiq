import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { GetPrivacyPolicyAction } from "../actions/legal/GetPrivacyPolicyAction.js";
import { GetTermsAction } from "../actions/legal/GetTermsAction.js";
import { GetLegalAdminAction } from "../actions/legal/GetLegalAdminAction.js";
import { UpdatePrivacyPolicyAction } from "../actions/legal/UpdatePrivacyPolicyAction.js";
import { UpdateTermsAction } from "../actions/legal/UpdateTermsAction.js";
import { GetMyAcceptanceAction } from "../actions/legal/GetMyAcceptanceAction.js";

const router = Router();

// Public — shareable links (no auth).
router.get("/legal/privacy", GetPrivacyPolicyAction.handle);
router.get("/legal/terms", GetTermsAction.handle);

// Authenticated — compliance indicator for the current user.
router.get("/legal/my-acceptance", requireAuth, GetMyAcceptanceAction.handle);

// Admin — author/publish content.
router.get("/legal/admin", requireAuth, requireRole("admin"), GetLegalAdminAction.handle);
router.put("/legal/privacy", requireAuth, requireRole("admin"), UpdatePrivacyPolicyAction.handle);
router.put("/legal/terms", requireAuth, requireRole("admin"), UpdateTermsAction.handle);

export default router;
