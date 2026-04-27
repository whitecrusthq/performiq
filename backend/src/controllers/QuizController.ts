import { Op } from "sequelize";
import Document from "../models/Document.js";
import DocumentQuestion from "../models/DocumentQuestion.js";
import QuizAttempt from "../models/QuizAttempt.js";
import User from "../models/User.js";

const PASS_THRESHOLD = 70;

export default class QuizController {
  /**
   * For the current user: list every document that has at least one question,
   * along with the user's most recent attempt status (if any).
   * Used to render the sequential quiz overview.
   */
  static async getOverview(userId: number) {
    const counts = (await DocumentQuestion.findAll({
      attributes: ["documentId", [DocumentQuestion.sequelize!.fn("COUNT", "*"), "count"]],
      group: ["documentId"],
      raw: true,
    })) as any[];
    const docIds = counts.map(c => Number(c.documentId));
    if (docIds.length === 0) return [];

    const docs = await Document.findAll({
      where: { id: { [Op.in]: docIds } },
      attributes: ["id", "title", "category", "description"],
      order: [["category", "ASC"], ["title", "ASC"]],
    });
    const countMap: Record<number, number> = {};
    counts.forEach((c: any) => { countMap[Number(c.documentId)] = Number(c.count); });

    const attempts = await QuizAttempt.findAll({
      where: { userId, documentId: { [Op.in]: docIds } },
      order: [["completedAt", "DESC"]],
    });
    const latest: Record<number, QuizAttempt> = {};
    for (const a of attempts) {
      if (!latest[a.documentId]) latest[a.documentId] = a;
    }

    return docs.map(d => {
      const a = latest[d.id];
      return {
        documentId: d.id,
        title: d.title,
        category: d.category,
        description: d.description,
        questionCount: countMap[d.id] ?? 0,
        latestAttempt: a
          ? { id: a.id, score: a.score, total: a.total, percent: a.percent, passed: a.passed, completedAt: a.completedAt }
          : null,
      };
    });
  }

  /** Returns questions for a document with NO correctIndex leaked to the client. */
  static async getQuiz(documentId: number) {
    const doc = await Document.findByPk(documentId, { attributes: ["id", "title", "category", "description"] });
    if (!doc) return { error: "Document not found", status: 404 };
    const rows = await DocumentQuestion.findAll({
      where: { documentId },
      order: [["id", "ASC"]],
    });
    if (rows.length === 0) return { error: "This document has no quiz questions yet", status: 400 };
    return {
      data: {
        document: doc.toJSON(),
        questions: rows.map(q => ({ id: q.id, question: q.question, choices: q.choices })),
      },
    };
  }

  static async submitQuiz(documentId: number, userId: number, answers: any[]) {
    const doc = await Document.findByPk(documentId, { attributes: ["id", "title", "category"] });
    if (!doc) return { error: "Document not found", status: 404 };
    if (!Array.isArray(answers)) return { error: "Answers must be an array", status: 400 };

    // Canonical question set for this document — server, not client, defines `total`.
    const canonical = await DocumentQuestion.findAll({ where: { documentId } });
    if (canonical.length === 0) return { error: "This document has no quiz questions", status: 400 };
    const canonicalMap: Record<number, DocumentQuestion> = {};
    canonical.forEach(q => { canonicalMap[q.id] = q; });

    // Index client answers (last write wins for any duplicate id, but we never trust the count)
    const userAnswerByQ: Record<number, number> = {};
    for (const a of answers) {
      const qid = Number(a?.questionId);
      const idx = Number(a?.answerIndex);
      if (!Number.isFinite(qid) || !canonicalMap[qid]) continue; // ignore unknown/foreign questions
      userAnswerByQ[qid] = Number.isFinite(idx) ? idx : -1;
    }

    let correct = 0;
    const breakdown = canonical.map(q => {
      const yourIndex = userAnswerByQ[q.id] ?? -1;
      const valid = Number.isInteger(yourIndex) && yourIndex >= 0 && yourIndex < q.choices.length;
      const isCorrect = valid && yourIndex === q.correctIndex;
      if (isCorrect) correct += 1;
      return { questionId: q.id, correct: isCorrect, correctIndex: q.correctIndex, yourIndex };
    });

    const total = canonical.length;
    const percent = Math.round((correct / total) * 100);
    const passed = percent >= PASS_THRESHOLD;

    const attempt = await QuizAttempt.create({
      userId,
      documentId: doc.id,
      score: correct,
      total,
      percent,
      passed,
      answers: breakdown,
    });

    return {
      data: {
        attemptId: attempt.id,
        documentId: doc.id,
        documentTitle: doc.title,
        category: doc.category,
        score: correct,
        total,
        percent,
        passed,
        threshold: PASS_THRESHOLD,
        results: breakdown,
        completedAt: attempt.completedAt,
      },
    };
  }

  /**
   * List attempts. Admins see everyone (with optional filters);
   * everyone else only sees their own attempts.
   */
  static async listAttempts(viewer: { id: number; role: string }, filters: any = {}) {
    const isAdmin = viewer.role === "admin" || viewer.role === "super_admin";
    const where: any = {};
    if (!isAdmin) {
      where.userId = viewer.id;
    } else if (filters.userId) {
      where.userId = Number(filters.userId);
    }
    if (filters.documentId) where.documentId = Number(filters.documentId);
    if (filters.from || filters.to) {
      where.completedAt = {};
      if (filters.from) where.completedAt[Op.gte] = new Date(String(filters.from));
      if (filters.to) where.completedAt[Op.lte] = new Date(String(filters.to));
    }
    const limit = Math.min(Math.max(Number(filters.limit) || 200, 1), 1000);

    const attempts = await QuizAttempt.findAll({
      where,
      order: [["completedAt", "DESC"]],
      limit,
    });

    const userIds = Array.from(new Set(attempts.map(a => a.userId)));
    const docIds = Array.from(new Set(attempts.map(a => a.documentId)));
    const [users, docs] = await Promise.all([
      userIds.length
        ? User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ["id", "name", "email"] })
        : Promise.resolve([] as any[]),
      docIds.length
        ? Document.findAll({ where: { id: { [Op.in]: docIds } }, attributes: ["id", "title", "category"] })
        : Promise.resolve([] as any[]),
    ]);
    const uMap: Record<number, any> = {};
    users.forEach((u: any) => { uMap[u.id] = u.toJSON(); });
    const dMap: Record<number, any> = {};
    docs.forEach((d: any) => { dMap[d.id] = d.toJSON(); });

    const data = attempts.map(a => ({
      id: a.id,
      userId: a.userId,
      user: uMap[a.userId] ?? null,
      documentId: a.documentId,
      document: dMap[a.documentId] ?? null,
      score: a.score,
      total: a.total,
      percent: a.percent,
      passed: a.passed,
      completedAt: a.completedAt,
    }));

    let summary: any = null;
    if (data.length) {
      const avg = Math.round(data.reduce((s, x) => s + x.percent, 0) / data.length);
      const pass = data.filter(x => x.passed).length;
      summary = { count: data.length, avgPercent: avg, passCount: pass, passRate: Math.round((pass / data.length) * 100) };
    }
    return { data, summary, isAdminView: isAdmin };
  }

  static async getAttempt(viewer: { id: number; role: string }, attemptId: number) {
    const a = await QuizAttempt.findByPk(attemptId);
    if (!a) return { error: "Not found", status: 404 };
    const isAdmin = viewer.role === "admin" || viewer.role === "super_admin";
    if (!isAdmin && a.userId !== viewer.id) return { error: "Forbidden", status: 403 };
    const [user, doc, questions] = await Promise.all([
      User.findByPk(a.userId, { attributes: ["id", "name", "email"] }),
      Document.findByPk(a.documentId, { attributes: ["id", "title", "category"] }),
      DocumentQuestion.findAll({ where: { documentId: a.documentId } }),
    ]);
    const qMap: Record<number, DocumentQuestion> = {};
    questions.forEach(q => { qMap[q.id] = q; });
    return {
      data: {
        id: a.id,
        user: user?.toJSON() ?? null,
        document: doc?.toJSON() ?? null,
        score: a.score,
        total: a.total,
        percent: a.percent,
        passed: a.passed,
        completedAt: a.completedAt,
        answers: (a.answers as any[]).map((ans: any) => {
          const q = qMap[Number(ans.questionId)];
          return {
            ...ans,
            questionText: q?.question ?? null,
            choices: q?.choices ?? [],
          };
        }),
      },
    };
  }
}
