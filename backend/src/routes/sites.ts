import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { ListSitesAction } from "../actions/sites/ListSitesAction.js";
import { CreateSiteAction } from "../actions/sites/CreateSiteAction.js";
import { UpdateSiteAction } from "../actions/sites/UpdateSiteAction.js";
import { DeleteSiteAction } from "../actions/sites/DeleteSiteAction.js";
import { BulkImportSitesAction } from "../actions/sites/BulkImportSitesAction.js";

const router = Router();

router.get("/sites", requireAuth, ListSitesAction.handle);
router.post("/sites", requireAuth, requireRole("admin"), CreateSiteAction.handle);
router.post("/sites/bulk-import", requireAuth, requireRole("admin"), BulkImportSitesAction.handle);
router.put("/sites/:id", requireAuth, requireRole("admin"), UpdateSiteAction.handle);
router.delete("/sites/:id", requireAuth, requireRole("admin"), DeleteSiteAction.handle);

export default router;
