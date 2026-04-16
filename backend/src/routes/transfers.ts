import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { ListTransfersAction } from "../actions/transfers/ListTransfersAction.js";
import { GetTransferAction } from "../actions/transfers/GetTransferAction.js";
import { CreateTransferAction } from "../actions/transfers/CreateTransferAction.js";
import { UpdateTransferAction } from "../actions/transfers/UpdateTransferAction.js";
import { GetEmployeeTransfersAction } from "../actions/transfers/GetEmployeeTransfersAction.js";
import { DeleteTransferAction } from "../actions/transfers/DeleteTransferAction.js";

const router = Router();

router.get("/transfers", requireAuth, requireRole("admin", "manager"), ListTransfersAction.handle);
router.get("/transfers/:id", requireAuth, GetTransferAction.handle);
router.post("/transfers", requireAuth, requireRole("admin", "manager"), CreateTransferAction.handle);
router.put("/transfers/:id", requireAuth, requireRole("admin", "manager"), UpdateTransferAction.handle);
router.get("/transfers/employee/:employeeId", requireAuth, GetEmployeeTransfersAction.handle);
router.delete("/transfers/:id", requireAuth, requireRole("admin"), DeleteTransferAction.handle);

export default router;
