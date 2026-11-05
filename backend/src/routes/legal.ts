import { Router } from "express";
import { requireAuth, requireAdminOrMenu } from "../middlewares/auth.js";
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
router.get("/legal/admin", requireAuth, requireAdminOrMenu("legal"), GetLegalAdminAction.handle);
router.put("/legal/privacy", requireAuth, requireAdminOrMenu("legal"), UpdatePrivacyPolicyAction.handle);
router.put("/legal/terms", requireAuth, requireAdminOrMenu("legal"), UpdateTermsAction.handle);

export default router;
