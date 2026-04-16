import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { RequestUploadUrlAction } from "../actions/storage/RequestUploadUrlAction.js";
import { ServeObjectAction } from "../actions/storage/ServeObjectAction.js";

const router = Router();

router.post("/storage/uploads/request-url", requireAuth, RequestUploadUrlAction.handle);
router.get("/storage/objects/:objectId", ServeObjectAction.handle);

export default router;
