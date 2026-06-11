import { Router, Response } from "express";
import { requireAuth, requireRole, AuthRequest } from "../middlewares/auth.js";
import StorageProviderController from "../controllers/StorageProviderController.js";

const router = Router();

function parseIdParam(raw: unknown): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = parseInt(String(s ?? ""), 10);
  return Number.isFinite(n) ? n : null;
}

router.get("/storage-providers", requireAuth, requireRole("admin"), async (_req: AuthRequest, res: Response) => {
  try {
    const [rows, meta] = await Promise.all([
      StorageProviderController.list(),
      Promise.resolve(StorageProviderController.metadata()),
    ]);
    res.json({ rows, ...meta });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/storage-providers", requireAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const userId: number | null = req.user?.id ?? null;
    const result = await StorageProviderController.create(req.body, userId);
    if ("error" in result) { res.status(result.status ?? 500).json({ error: result.error }); return; }
    res.status(201).json(result.data);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/storage-providers/:id", requireAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseIdParam(req.params.id);
    if (id === null) { res.status(400).json({ error: "Invalid id" }); return; }
    const result = await StorageProviderController.update(id, req.body);
    if ("error" in result) { res.status(result.status ?? 500).json({ error: result.error }); return; }
    res.json(result.data);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/storage-providers/:id/default", requireAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseIdParam(req.params.id);
    if (id === null) { res.status(400).json({ error: "Invalid id" }); return; }
    const result = await StorageProviderController.setDefault(id);
    if ("error" in result) { res.status(result.status ?? 500).json({ error: result.error }); return; }
    res.json(result.data);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/storage-providers/:id", requireAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseIdParam(req.params.id);
    if (id === null) { res.status(400).json({ error: "Invalid id" }); return; }
    const result = await StorageProviderController.remove(id);
    if ("error" in result) { res.status(result.status ?? 500).json({ error: result.error }); return; }
    res.json(result.data);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
