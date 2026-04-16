import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { ListQueriesAction } from "../actions/hr-queries/ListQueriesAction.js";
import { GetQueryAction } from "../actions/hr-queries/GetQueryAction.js";
import { CreateQueryAction } from "../actions/hr-queries/CreateQueryAction.js";
import { UpdateQueryAction } from "../actions/hr-queries/UpdateQueryAction.js";
import { GetMessagesAction } from "../actions/hr-queries/GetMessagesAction.js";
import { CreateMessageAction } from "../actions/hr-queries/CreateMessageAction.js";
import { DeleteQueryAction } from "../actions/hr-queries/DeleteQueryAction.js";

const router = Router();

router.get("/hr-queries", requireAuth, ListQueriesAction.handle);
router.get("/hr-queries/:id", requireAuth, GetQueryAction.handle);
router.post("/hr-queries", requireAuth, CreateQueryAction.handle);
router.put("/hr-queries/:id", requireAuth, UpdateQueryAction.handle);
router.get("/hr-queries/:id/messages", requireAuth, GetMessagesAction.handle);
router.post("/hr-queries/:id/messages", requireAuth, CreateMessageAction.handle);
router.delete("/hr-queries/:id", requireAuth, DeleteQueryAction.handle);

export default router;
