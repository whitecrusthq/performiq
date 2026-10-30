import { Router } from "express";
import { requireAuth, requireStaffEmailAccess } from "../middlewares/auth.js";
import { GetStaffEmailOptionsAction } from "../actions/staff-emails/GetStaffEmailOptionsAction.js";
import { PreviewStaffEmailRecipientsAction } from "../actions/staff-emails/PreviewStaffEmailRecipientsAction.js";
import { SendStaffEmailAction } from "../actions/staff-emails/SendStaffEmailAction.js";
import { ListStaffEmailHistoryAction } from "../actions/staff-emails/ListStaffEmailHistoryAction.js";

const router = Router();

router.get("/staff-emails/options", requireAuth, requireStaffEmailAccess, GetStaffEmailOptionsAction.handle);
router.post("/staff-emails/preview", requireAuth, requireStaffEmailAccess, PreviewStaffEmailRecipientsAction.handle);
router.post("/staff-emails/send", requireAuth, requireStaffEmailAccess, SendStaffEmailAction.handle);
router.get("/staff-emails/history", requireAuth, requireStaffEmailAccess, ListStaffEmailHistoryAction.handle);

export default router;
