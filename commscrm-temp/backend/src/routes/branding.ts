import { Router } from "express";
import multer from "multer";
import { BrandingSettings } from "../models/index.js";
import { requireAuth, requireAdmin, AuthRequest } from "../middlewares/auth.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/svg+xml"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only image files are supported (PNG, JPG, GIF, WebP, SVG)"));
  },
});

async function getOrCreateBranding() {
  const [row] = await BrandingSettings.findOrCreate({
    where: { id: 1 },
    defaults: {
      appName: "CommsCRM",
      primaryColor: "#4F46E5",
      sidebarColor: "#3F0E40",
      logoData: null,
      backgroundData: null,
    },
  });
  return row;
}

router.get("/branding", async (_req, res) => {
  try {
    const branding = await getOrCreateBranding();
    res.json({
      appName: branding.appName,
      primaryColor: branding.primaryColor,
      sidebarColor: branding.sidebarColor,
      hasLogo: !!branding.logoData,
      logoData: branding.logoData,
      hasBackground: !!branding.backgroundData,
      backgroundData: branding.backgroundData,
    });
  } catch (err) {
    console.error("Branding GET error:", err);
    res.status(500).json({ error: "Failed to fetch branding settings" });
  }
});

router.put("/branding", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { appName, primaryColor, sidebarColor, logoData, backgroundData, clearLogo, clearBackground } = req.body;
    const branding = await getOrCreateBranding();

    const updates: Partial<{
      appName: string;
      primaryColor: string;
      sidebarColor: string;
      logoData: string | null;
      backgroundData: string | null;
    }> = {};

    if (appName !== undefined) updates.appName = String(appName).slice(0, 100);
    if (primaryColor !== undefined && /^#[0-9a-fA-F]{6}$/.test(primaryColor)) updates.primaryColor = primaryColor;
    if (sidebarColor !== undefined && /^#[0-9a-fA-F]{6}$/.test(sidebarColor)) updates.sidebarColor = sidebarColor;
    if (logoData !== undefined) updates.logoData = logoData || null;
    if (backgroundData !== undefined) updates.backgroundData = backgroundData || null;
    if (clearLogo) updates.logoData = null;
    if (clearBackground) updates.backgroundData = null;

    await branding.update(updates);
    res.json({ success: true, message: "Branding updated" });
  } catch (err) {
    console.error("Branding PUT error:", err);
    res.status(500).json({ error: "Failed to update branding settings" });
  }
});

router.post("/branding/upload/logo", requireAuth, requireAdmin, upload.single("file"), async (req: AuthRequest, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
    const base64 = req.file.buffer.toString("base64");
    const dataUrl = `data:${req.file.mimetype};base64,${base64}`;
    const branding = await getOrCreateBranding();
    await branding.update({ logoData: dataUrl });
    res.json({ success: true, logoData: dataUrl });
  } catch (err) {
    console.error("Logo upload error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Upload failed" });
  }
});

router.post("/branding/upload/background", requireAuth, requireAdmin, upload.single("file"), async (req: AuthRequest, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
    const base64 = req.file.buffer.toString("base64");
    const dataUrl = `data:${req.file.mimetype};base64,${base64}`;
    const branding = await getOrCreateBranding();
    await branding.update({ backgroundData: dataUrl });
    res.json({ success: true, backgroundData: dataUrl });
  } catch (err) {
    console.error("Background upload error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Upload failed" });
  }
});

export default router;
