import { Router, Response } from "express";
import { requireAuth, AuthRequest, requireAdminOrMenu } from "../middlewares/auth.js";
import AiSettingsController from "../controllers/AiSettingsController.js";

const router = Router();

router.get("/ai-settings", requireAuth, requireAdminOrMenu("ai-settings"), async (_req: AuthRequest, res: Response) => {
  try {
    const [settings, meta] = await Promise.all([
      AiSettingsController.getSettings(),
      Promise.resolve(AiSettingsController.metadata()),
    ]);
    res.json({ ...settings, ...meta });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/ai-settings", requireAuth, requireAdminOrMenu("ai-settings"), async (req: AuthRequest, res: Response) => {
  try {
    const result = await AiSettingsController.updateSettings(req.body);
    if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
    res.json(result.data);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/ai-settings/test", requireAuth, requireAdminOrMenu("ai-settings"), async (_req: AuthRequest, res: Response) => {
  try {
    res.json(await AiSettingsController.testConnection());
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
