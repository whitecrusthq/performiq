import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { ListCustomRolesAction } from "../actions/custom-roles/ListCustomRolesAction.js";
import { CreateCustomRoleAction } from "../actions/custom-roles/CreateCustomRoleAction.js";
import { UpdateCustomRoleAction } from "../actions/custom-roles/UpdateCustomRoleAction.js";
import { DeleteCustomRoleAction } from "../actions/custom-roles/DeleteCustomRoleAction.js";

const router = Router();

router.get("/custom-roles", requireAuth, ListCustomRolesAction.handle);
router.post("/custom-roles", requireAuth, requireRole("admin"), CreateCustomRoleAction.handle);
router.put("/custom-roles/:id", requireAuth, requireRole("admin"), UpdateCustomRoleAction.handle);
router.delete("/custom-roles/:id", requireAuth, requireRole("admin"), DeleteCustomRoleAction.handle);

export default router;
