import { Router } from "express";
import { requireAuth, requireAdminOrMenu } from "../middlewares/auth.js";
import { ListSitesAction } from "../actions/sites/ListSitesAction.js";
import { CreateSiteAction } from "../actions/sites/CreateSiteAction.js";
import { UpdateSiteAction } from "../actions/sites/UpdateSiteAction.js";
import { DeleteSiteAction } from "../actions/sites/DeleteSiteAction.js";
import { BulkImportSitesAction } from "../actions/sites/BulkImportSitesAction.js";

const router = Router();

router.get("/sites", requireAuth, ListSitesAction.handle);
router.post("/sites", requireAuth, requireAdminOrMenu("sites"), CreateSiteAction.handle);
router.post("/sites/bulk-import", requireAuth, requireAdminOrMenu("sites"), BulkImportSitesAction.handle);
router.put("/sites/:id", requireAuth, requireAdminOrMenu("sites"), UpdateSiteAction.handle);
router.delete("/sites/:id", requireAuth, requireAdminOrMenu("sites"), DeleteSiteAction.handle);

export default router;
