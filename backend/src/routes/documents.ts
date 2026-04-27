import { Router } from "express";
import { requireAuth, requireRole, AuthRequest } from "../middlewares/auth.js";
import { Response } from "express";
import DocumentController from "../controllers/DocumentController.js";

const router = Router();

router.get("/documents/categories", requireAuth, (_req, res) => {
  res.json(DocumentController.categories());
});

router.get("/documents", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    res.json(await DocumentController.listDocuments(category));
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/documents/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const doc = await DocumentController.getDocument(Number(req.params.id));
    if (!doc) { res.status(404).json({ error: "Not found" }); return; }
    res.json(doc);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/documents", requireAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const result = await DocumentController.createDocument(req.user!.id, req.body);
    if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
    res.json(result.data);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/documents/:id", requireAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const result = await DocumentController.updateDocument(Number(req.params.id), req.body);
    if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
    res.json(result.data);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/documents/:id", requireAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const result = await DocumentController.deleteDocument(Number(req.params.id));
    if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
    res.json(result.data);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/documents/:id/questions", requireAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    res.json(await DocumentController.listQuestions(Number(req.params.id)));
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/documents/:id/questions", requireAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const result = await DocumentController.addQuestion(Number(req.params.id), req.user!.id, req.body);
    if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
    res.json(result.data);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/documents/:id/questions/:qid", requireAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const result = await DocumentController.deleteQuestion(Number(req.params.id), Number(req.params.qid));
    if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
    res.json(result.data);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/documents/:id/questions/generate", requireAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const count = Number(req.body?.count) || 5;
    const result = await DocumentController.generateQuestionsFromDocument(Number(req.params.id), req.user!.id, count);
    if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
    res.json(result.data);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/quiz/random", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const count = Number(req.query.count) || 10;
    res.json(await DocumentController.randomQuiz(count));
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/quiz/submit", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await DocumentController.submitQuiz(req.body?.answers ?? []);
    if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
    res.json(result.data);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
