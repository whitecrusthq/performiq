import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { ListAnniversariesAction } from "../actions/anniversaries/ListAnniversariesAction.js";
import { ListBirthdaysAction } from "../actions/anniversaries/ListBirthdaysAction.js";
import { ListWeddingsAction } from "../actions/anniversaries/ListWeddingsAction.js";
import { ListRemindersAction } from "../actions/anniversaries/ListRemindersAction.js";
import { CreateReminderAction } from "../actions/anniversaries/CreateReminderAction.js";
import { UpdateReminderAction } from "../actions/anniversaries/UpdateReminderAction.js";
import { DeleteReminderAction } from "../actions/anniversaries/DeleteReminderAction.js";

const router = Router();

router.get("/anniversaries", requireAuth, requireRole("admin", "manager"), ListAnniversariesAction.handle);
router.get("/birthdays", requireAuth, requireRole("admin", "manager"), ListBirthdaysAction.handle);
router.get("/weddings", requireAuth, requireRole("admin", "manager"), ListWeddingsAction.handle);
router.get("/reminders", requireAuth, requireRole("admin", "manager"), ListRemindersAction.handle);
router.post("/reminders", requireAuth, requireRole("admin", "manager"), CreateReminderAction.handle);
router.put("/reminders/:id", requireAuth, requireRole("admin", "manager"), UpdateReminderAction.handle);
router.delete("/reminders/:id", requireAuth, requireRole("admin", "manager"), DeleteReminderAction.handle);

export default router;
