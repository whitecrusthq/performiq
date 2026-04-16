import { Router } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import { getUploadURL, serveObject } from "../lib/storage.js";

const router = Router();

router.post("/storage/uploads/request-url", requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await getUploadURL();
    res.json(result);
  } catch (err: any) {
    console.error("Storage upload URL error:", err);
    res.status(500).json({ error: err.message || "Failed to generate upload URL" });
  }
});

router.get("/storage/objects/:objectId", async (req, res) => {
  try {
    const objectPath = "/objects/uploads/" + req.params.objectId;
    await serveObject(objectPath, res);
  } catch (err: any) {
    console.error("Storage serve error:", err);
    res.status(500).json({ error: "Failed to serve file" });
  }
});

export default router;
