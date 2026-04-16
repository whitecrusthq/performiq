import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { ListDepartmentsAction } from "../actions/departments/ListDepartmentsAction.js";
import { CreateDepartmentAction } from "../actions/departments/CreateDepartmentAction.js";
import { UpdateDepartmentAction } from "../actions/departments/UpdateDepartmentAction.js";
import { DeleteDepartmentAction } from "../actions/departments/DeleteDepartmentAction.js";

const router = Router();

router.get("/departments", requireAuth, ListDepartmentsAction.handle);
router.post("/departments", requireAuth, requireRole("admin"), CreateDepartmentAction.handle);
router.put("/departments/:id", requireAuth, requireRole("admin"), UpdateDepartmentAction.handle);
router.delete("/departments/:id", requireAuth, requireRole("admin"), DeleteDepartmentAction.handle);

export default router;
