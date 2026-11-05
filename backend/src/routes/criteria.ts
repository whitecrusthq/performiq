import { Router } from "express";
import { requireAuth, requireAdminOrMenu } from "../middlewares/auth.js";
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
router.post("/criteria", requireAuth, requireAdminOrMenu("criteria"), CreateCriterionAction.handle);
router.put("/criteria/:id", requireAuth, requireAdminOrMenu("criteria"), UpdateCriterionAction.handle);
router.delete("/criteria/:id", requireAuth, requireAdminOrMenu("criteria"), DeleteCriterionAction.handle);

router.get("/criteria-groups", requireAuth, ListCriteriaGroupsAction.handle);
router.post("/criteria-groups", requireAuth, requireAdminOrMenu("criteria"), CreateCriteriaGroupAction.handle);
router.put("/criteria-groups/:id", requireAuth, requireAdminOrMenu("criteria"), UpdateCriteriaGroupAction.handle);
router.delete("/criteria-groups/:id", requireAuth, requireAdminOrMenu("criteria"), DeleteCriteriaGroupAction.handle);

export default router;
