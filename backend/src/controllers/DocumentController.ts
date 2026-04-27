import { Op } from "sequelize";
import Document from "../models/Document.js";
import DocumentQuestion from "../models/DocumentQuestion.js";
import User from "../models/User.js";

const ALLOWED_CATEGORIES = ["HR", "IT", "ESG", "Finance", "Operations", "Compliance", "Health & Safety", "Other"];

function normalizeCategory(value: any): string {
  const v = String(value ?? "").trim();
  if (!v) return "Other";
  const match = ALLOWED_CATEGORIES.find(c => c.toLowerCase() === v.toLowerCase());
  return match ?? v.slice(0, 60);
}

async function withUploader(rows: Document[]) {
  const ids = Array.from(new Set(rows.map(r => r.uploadedBy)));
  if (ids.length === 0) return rows.map(r => r.toJSON());
  const users = await User.findAll({
    where: { id: { [Op.in]: ids } },
    attributes: ["id", "name", "email"],
  });
  const map: Record<number, any> = {};
  users.forEach(u => { map[u.id] = u.toJSON(); });
  return rows.map(r => ({ ...r.toJSON(), uploader: map[r.uploadedBy] ?? null }));
}

export default class DocumentController {
  static categories() { return ALLOWED_CATEGORIES; }

  static async listDocuments(category?: string) {
    const where: any = {};
    if (category && category !== "all") where.category = category;
    const rows = await Document.findAll({ where, order: [["category", "ASC"], ["title", "ASC"]] });
    const enriched = await withUploader(rows);
    const counts = await DocumentQuestion.findAll({
      attributes: ["documentId", [DocumentQuestion.sequelize!.fn("COUNT", "*"), "count"]],
      group: ["documentId"],
      raw: true,
    }) as any[];
    const countMap: Record<number, number> = {};
    counts.forEach((c: any) => { countMap[c.documentId] = Number(c.count); });
    return enriched.map(d => ({ ...d, questionCount: countMap[d.id] ?? 0 }));
  }

  static async getDocument(id: number) {
    const row = await Document.findByPk(id);
    if (!row) return null;
    const [enriched] = await withUploader([row]);
    return enriched;
  }

  static async createDocument(userId: number, data: any) {
    const title = String(data?.title ?? "").trim();
    const objectPath = String(data?.objectPath ?? "").trim();
    if (!title) return { error: "Title is required", status: 400 };
    if (!objectPath) return { error: "Upload the document file first", status: 400 };

    const row = await Document.create({
      title: title.slice(0, 200),
      description: data?.description ? String(data.description).slice(0, 2000) : null,
      category: normalizeCategory(data?.category),
      objectPath,
      mimeType: data?.mimeType ? String(data.mimeType).slice(0, 120) : null,
      fileSize: Number.isFinite(Number(data?.fileSize)) ? Number(data.fileSize) : null,
      originalFilename: data?.originalFilename ? String(data.originalFilename).slice(0, 255) : null,
      quizSourceText: data?.quizSourceText ? String(data.quizSourceText).slice(0, 50000) : null,
      uploadedBy: userId,
    });
    return { data: await DocumentController.getDocument(row.id) };
  }

  static async updateDocument(id: number, data: any) {
    const row = await Document.findByPk(id);
    if (!row) return { error: "Not found", status: 404 };
    const updates: any = { updatedAt: new Date() };
    if (data?.title !== undefined) updates.title = String(data.title).slice(0, 200);
    if (data?.description !== undefined) updates.description = data.description ? String(data.description).slice(0, 2000) : null;
    if (data?.category !== undefined) updates.category = normalizeCategory(data.category);
    if (data?.quizSourceText !== undefined) updates.quizSourceText = data.quizSourceText ? String(data.quizSourceText).slice(0, 50000) : null;
    if (data?.objectPath !== undefined && String(data.objectPath).trim()) updates.objectPath = String(data.objectPath).trim();
    if (data?.mimeType !== undefined) updates.mimeType = data.mimeType ? String(data.mimeType).slice(0, 120) : null;
    if (data?.fileSize !== undefined) updates.fileSize = Number.isFinite(Number(data.fileSize)) ? Number(data.fileSize) : null;
    if (data?.originalFilename !== undefined) updates.originalFilename = data.originalFilename ? String(data.originalFilename).slice(0, 255) : null;
    await Document.update(updates, { where: { id } });
    return { data: await DocumentController.getDocument(id) };
  }

  static async deleteDocument(id: number) {
    const row = await Document.findByPk(id);
    if (!row) return { error: "Not found", status: 404 };
    await Document.destroy({ where: { id } });
    return { data: { ok: true } };
  }

  // ---- Questions ----

  static async listQuestions(documentId: number) {
    const rows = await DocumentQuestion.findAll({ where: { documentId }, order: [["createdAt", "DESC"]] });
    return rows.map(r => r.toJSON());
  }

  static async addQuestion(documentId: number, userId: number, data: any) {
    const doc = await Document.findByPk(documentId);
    if (!doc) return { error: "Document not found", status: 404 };
    const question = String(data?.question ?? "").trim();
    const choices = Array.isArray(data?.choices) ? data.choices.map((c: any) => String(c ?? "").trim()).filter(Boolean) : [];
    const correctIndex = Number(data?.correctIndex);
    if (!question) return { error: "Question text is required", status: 400 };
    if (choices.length < 2) return { error: "At least 2 answer choices are required", status: 400 };
    if (choices.length > 6) return { error: "At most 6 answer choices are allowed", status: 400 };
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= choices.length) {
      return { error: "correctIndex must reference one of the choices", status: 400 };
    }
    const row = await DocumentQuestion.create({
      documentId,
      question: question.slice(0, 2000),
      choices: choices.map((c: string) => c.slice(0, 500)),
      correctIndex,
      source: data?.source === "ai" ? "ai" : "manual",
      createdBy: userId,
    });
    return { data: row.toJSON() };
  }

  static async deleteQuestion(documentId: number, questionId: number) {
    const row = await DocumentQuestion.findOne({ where: { id: questionId, documentId } });
    if (!row) return { error: "Not found", status: 404 };
    await DocumentQuestion.destroy({ where: { id: questionId } });
    return { data: { ok: true } };
  }

  static async generateQuestionsFromDocument(documentId: number, userId: number, count: number) {
    const doc = await Document.findByPk(documentId);
    if (!doc) return { error: "Document not found", status: 404 };
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        error: "AI question generation is not configured. An administrator must set the GEMINI_API_KEY secret (Google AI Studio key) to enable this. In the meantime, you can author questions manually.",
        status: 400,
      };
    }
    const source = doc.quizSourceText && doc.quizSourceText.trim().length > 0
      ? doc.quizSourceText
      : (doc.description ?? "");
    if (!source || source.trim().length < 50) {
      return {
        error: "Add quiz reference text (a paragraph or two from the document) on the document before generating questions.",
        status: 400,
      };
    }
    const n = Math.min(Math.max(Number(count) || 5, 1), 15);
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    let parsed: any[] = [];
    try {
      const prompt = `You are an HR training assistant. Read the following policy text and write ${n} multiple-choice quiz questions that test whether an employee understood it. Each question must have 4 plausible choices and exactly one correct answer.\n\nReturn ONLY a JSON array, no prose. Each item: {"question": "...", "choices": ["...","...","...","..."], "correctIndex": 0}\n\nPolicy text:\n"""\n${source.slice(0, 8000)}\n"""`;
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.4,
              responseMimeType: "application/json",
            },
          }),
        }
      );
      if (!r.ok) {
        const txt = await r.text();
        return { error: `AI request failed: ${r.status} ${txt.slice(0, 200)}`, status: 502 };
      }
      const body: any = await r.json();
      const content =
        body?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "[]";
      const obj = JSON.parse(content);
      parsed = Array.isArray(obj) ? obj : (Array.isArray(obj?.questions) ? obj.questions : []);
    } catch (err: any) {
      return { error: `AI parse error: ${err?.message ?? "unknown"}`, status: 502 };
    }

    const created: any[] = [];
    for (const item of parsed) {
      const q = String(item?.question ?? "").trim();
      const choices = Array.isArray(item?.choices) ? item.choices.map((c: any) => String(c ?? "").trim()).filter(Boolean) : [];
      const idx = Number(item?.correctIndex);
      if (!q || choices.length < 2 || !Number.isInteger(idx) || idx < 0 || idx >= choices.length) continue;
      const row = await DocumentQuestion.create({
        documentId,
        question: q.slice(0, 2000),
        choices: choices.map((c: string) => c.slice(0, 500)),
        correctIndex: idx,
        source: "ai",
        createdBy: userId,
      });
      created.push(row.toJSON());
    }
    return { data: { created, count: created.length } };
  }

  // ---- Quiz: random sampling for end users ----

  static async randomQuiz(count: number) {
    const n = Math.min(Math.max(Number(count) || 10, 1), 30);
    const all = await DocumentQuestion.findAll();
    if (all.length === 0) return [];
    const docs = await Document.findAll({ attributes: ["id", "title", "category"] });
    const docMap: Record<number, any> = {};
    docs.forEach(d => { docMap[d.id] = d.toJSON(); });
    const shuffled = [...all].sort(() => Math.random() - 0.5).slice(0, n);
    return shuffled.map(q => ({
      id: q.id,
      question: q.question,
      choices: q.choices,
      documentId: q.documentId,
      document: docMap[q.documentId] ?? null,
    }));
  }

  static async submitQuiz(answers: { questionId: number; answerIndex: number }[]) {
    if (!Array.isArray(answers) || answers.length === 0) {
      return { error: "Submit at least one answer", status: 400 };
    }
    if (answers.length > 50) {
      return { error: "Too many answers in one submission", status: 400 };
    }
    const ids = answers.map(a => Number(a.questionId)).filter(Number.isFinite);
    const rows = await DocumentQuestion.findAll({ where: { id: { [Op.in]: ids } } });
    const map: Record<number, DocumentQuestion> = {};
    rows.forEach(r => { map[r.id] = r; });
    let correct = 0;
    const results = answers.map(a => {
      const q = map[Number(a.questionId)];
      if (!q) return { questionId: a.questionId, correct: false, correctIndex: null, yourIndex: a.answerIndex };
      const isCorrect = Number(a.answerIndex) === q.correctIndex;
      if (isCorrect) correct += 1;
      return { questionId: a.questionId, correct: isCorrect, correctIndex: q.correctIndex, yourIndex: a.answerIndex };
    });
    return { data: { score: correct, total: answers.length, percent: Math.round((correct / answers.length) * 100), results } };
  }
}
