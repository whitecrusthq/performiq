import { Router, Response } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import QuizController from "../controllers/QuizController.js";

const router = Router();

router.get("/quiz/overview", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    res.json(await QuizController.getOverview(req.user!.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/quiz/documents/:id/take", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await QuizController.getQuiz(Number(req.params.id));
    if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
    res.json(result.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/quiz/documents/:id/submit", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await QuizController.submitQuiz(Number(req.params.id), req.user!.id, req.body?.answers ?? []);
    if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
    res.json(result.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/quiz/attempts", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await QuizController.listAttempts(
      { id: req.user!.id, role: req.user!.role },
      req.query,
    );
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/quiz/attempts/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await QuizController.getAttempt(
      { id: req.user!.id, role: req.user!.role },
      Number(req.params.id),
    );
    if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
    res.json(result.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
