import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { RequestUploadUrlAction } from "../actions/storage/RequestUploadUrlAction.js";
import { ServeObjectAction } from "../actions/storage/ServeObjectAction.js";
import { ProxyUploadAction } from "../actions/storage/ProxyUploadAction.js";

const router = Router();

router.post("/storage/uploads/request-url", requireAuth, RequestUploadUrlAction.handle);
// Token-authenticated (no requireAuth): the browser PUTs file bytes here and the
// backend forwards them to the configured S3-family bucket (e.g. DigitalOcean).
router.put("/storage/proxy-upload/:token", ProxyUploadAction.handle);
router.get("/storage/objects/:objectId", ServeObjectAction.handle);

export default router;
