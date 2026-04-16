import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { ListCriteriaAction } from "../actions/criteria/ListCriteriaAction.js";
import { CreateCriterionAction } from "../actions/criteria/CreateCriterionAction.js";
import { UpdateCriterionAction } from "../actions/criteria/UpdateCriterionAction.js";
import { DeleteCriterionAction } from "../actions/criteria/DeleteCriterionAction.js";
import { ListCriteriaGroupsAction } from "../actions/criteria/ListCriteriaGroupsAction.js";
import { CreateCriteriaGroupAction } from "../actions/criteria/CreateCriteriaGroupAction.js";
import { UpdateCriteriaGroupAction } from "../actions/criteria/UpdateCriteriaGroupAction.js";
import { DeleteCriteriaGroupAction } from "../actions/criteria/DeleteCriteriaGroupAction.js";

const router = Router();

router.get("/criteria", requireAuth, ListCriteriaAction.handle);
router.post("/criteria", requireAuth, requireRole("admin"), CreateCriterionAction.handle);
router.put("/criteria/:id", requireAuth, requireRole("admin"), UpdateCriterionAction.handle);
router.delete("/criteria/:id", requireAuth, requireRole("admin"), DeleteCriterionAction.handle);

router.get("/criteria-groups", requireAuth, ListCriteriaGroupsAction.handle);
router.post("/criteria-groups", requireAuth, requireRole("admin"), CreateCriteriaGroupAction.handle);
router.put("/criteria-groups/:id", requireAuth, requireRole("admin"), UpdateCriteriaGroupAction.handle);
router.delete("/criteria-groups/:id", requireAuth, requireRole("admin"), DeleteCriteriaGroupAction.handle);

export default router;
