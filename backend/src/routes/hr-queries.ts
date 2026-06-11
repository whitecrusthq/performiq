import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { ListQueriesAction } from "../actions/hr-queries/ListQueriesAction.js";
import { GetQueryAction } from "../actions/hr-queries/GetQueryAction.js";
import { CreateQueryAction } from "../actions/hr-queries/CreateQueryAction.js";
import { UpdateQueryAction } from "../actions/hr-queries/UpdateQueryAction.js";
import { GetMessagesAction } from "../actions/hr-queries/GetMessagesAction.js";
import { CreateMessageAction } from "../actions/hr-queries/CreateMessageAction.js";
import { DeleteQueryAction } from "../actions/hr-queries/DeleteQueryAction.js";
import { SuggestReplyAction } from "../actions/hr-queries/SuggestReplyAction.js";
import { TransferQueryAction } from "../actions/hr-queries/TransferQueryAction.js";
import { EscalateQueryAction } from "../actions/hr-queries/EscalateQueryAction.js";
import { GetMetricsAction } from "../actions/hr-queries/GetMetricsAction.js";
import { ListHrUsersAction } from "../actions/hr-queries/ListHrUsersAction.js";

const router = Router();

// Collection-level / static-path routes MUST come before /:id-parameterised routes
router.get("/hr-queries/metrics", requireAuth, GetMetricsAction.handle);
router.get("/hr-queries/hr-users", requireAuth, ListHrUsersAction.handle);

router.get("/hr-queries", requireAuth, ListQueriesAction.handle);
router.post("/hr-queries", requireAuth, CreateQueryAction.handle);
router.get("/hr-queries/:id", requireAuth, GetQueryAction.handle);
router.put("/hr-queries/:id", requireAuth, UpdateQueryAction.handle);
router.delete("/hr-queries/:id", requireAuth, DeleteQueryAction.handle);
router.get("/hr-queries/:id/messages", requireAuth, GetMessagesAction.handle);
router.post("/hr-queries/:id/messages", requireAuth, CreateMessageAction.handle);
router.post("/hr-queries/:id/suggest-reply", requireAuth, SuggestReplyAction.handle);
router.post("/hr-queries/:id/transfer", requireAuth, TransferQueryAction.handle);
router.post("/hr-queries/:id/escalate", requireAuth, EscalateQueryAction.handle);

export default router;
