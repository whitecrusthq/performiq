import test from "node:test";
import assert from "node:assert/strict";
import DocumentController from "./DocumentController.js";
import AiSettingsController from "./AiSettingsController.js";
import StorageProviderController from "./StorageProviderController.js";
import Document from "../models/Document.js";
import DocumentQuestion from "../models/DocumentQuestion.js";

/** Storage is unavailable in tests, so these cover the reference-text fallback and the error paths. */
function stubAll(doc: any, existing: string[] = []) {
  const originals = {
    find: Document.findByPk, cfg: AiSettingsController.getActiveConfig, prov: StorageProviderController.getActiveUploadProvider,
    qFind: DocumentQuestion.findAll, qCreate: DocumentQuestion.create, fetch: globalThis.fetch, dir: process.env.PRIVATE_OBJECT_DIR,
  };
  const calls: any[] = [];
  delete process.env.PRIVATE_OBJECT_DIR;
  (Document.findByPk as any) = async () => doc;
  (AiSettingsController.getActiveConfig as any) = async () => ({ provider: "gemini", apiKey: "k", model: "gemini-3.8-flash" });
  (StorageProviderController.getActiveUploadProvider as any) = async () => null;
  (DocumentQuestion.findAll as any) = async () => existing.map(question => ({ question }));
  (DocumentQuestion.create as any) = async (row: any) => ({ toJSON: () => row });
  (globalThis as any).fetch = async (_url: string, init: any) => {
    calls.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify([
      { question: "How many leave days?", choices: ["10", "20", "30", "40"], correctIndex: 1 },
      { question: "bad", choices: ["only one"], correctIndex: 0 },
    ]) }] } }] }), { status: 200 });
  };
  const restore = () => {
    (Document.findByPk as any) = originals.find;
    (AiSettingsController.getActiveConfig as any) = originals.cfg;
    (StorageProviderController.getActiveUploadProvider as any) = originals.prov;
    (DocumentQuestion.findAll as any) = originals.qFind;
    (DocumentQuestion.create as any) = originals.qCreate;
    (globalThis as any).fetch = originals.fetch;
    if (originals.dir !== undefined) process.env.PRIVATE_OBJECT_DIR = originals.dir;
  };
  return { calls, restore };
}

const baseDoc = { id: 3, title: "Leave Policy", objectPath: "/objects/uploads/abc", mimeType: "application/pdf", originalFilename: "leave.pdf", description: null };

test("unreadable file with no reference text explains why and what to do", async () => {
  const { calls, restore } = stubAll({ ...baseDoc, quizSourceText: null });
  try {
    const r: any = await DocumentController.generateQuestionsFromDocument(3, 1, 5);
    assert.equal(r.status, 400);
    assert.match(r.error, /couldn't be read/);
    assert.match(r.error, /Quiz focus/);
    assert.equal(calls.length, 0, "no AI call without content");
  } finally { restore(); }
});

test("falls back to reference text, skips invalid AI items and avoids existing questions", async () => {
  const focus = "Employees get 20 days of annual leave. Requests need manager approval two weeks ahead.";
  const { calls, restore } = stubAll({ ...baseDoc, quizSourceText: focus }, ["What is the notice period?"]);
  try {
    const r: any = await DocumentController.generateQuestionsFromDocument(3, 9, 50);
    assert.equal(r.data.count, 1);
    assert.equal(r.data.source, "reference_text");
    assert.match(r.data.notice, /couldn't be read/);
    assert.equal(r.data.created[0].source, "ai");
    assert.equal(r.data.created[0].createdBy, 9);
    const prompt = calls[0].contents[0].parts.map((p: any) => p.text).join("");
    assert.match(prompt, /Write 15 multiple-choice/, "count is capped at 15");
    assert.ok(prompt.includes(focus));
    assert.ok(prompt.includes("What is the notice period?"), "existing questions are listed to avoid repeats");
  } finally { restore(); }
});

test("documents can only reference an uploaded file path", async () => {
  const originals = { create: Document.create, find: Document.findByPk, update: Document.update };
  let created = false;
  try {
    (Document.create as any) = async () => { created = true; return { id: 1 }; };
    (Document.findByPk as any) = async () => ({ id: 1, update: async () => {} });
    (Document.update as any) = async () => [1];
    for (const bad of ["/objects/uploads/../private/x", "/objects/other/3f1c", "https://evil.example/x.pdf", "/objects/uploads/not-a-uuid"]) {
      const r: any = await DocumentController.createDocument(1, { title: "T", objectPath: bad });
      assert.equal(r.status, 400, bad);
      const u: any = await DocumentController.updateDocument(1, { objectPath: bad });
      assert.equal(u.status, 400, bad);
    }
    assert.equal(created, false);
  } finally {
    (Document.create as any) = originals.create;
    (Document.findByPk as any) = originals.find;
    (Document.update as any) = originals.update;
  }
});

test("editing keeps the file unless a valid replacement is given, and requires a title", async () => {
  const originals = { find: Document.findByPk, update: Document.update, get: DocumentController.getDocument };
  let updates: any = null;
  try {
    (Document.findByPk as any) = async () => ({ id: 1 });
    (Document.update as any) = async (u: any) => { updates = u; return [1]; };
    (DocumentController as any).getDocument = async () => ({ id: 1 });

    await DocumentController.updateDocument(1, { title: "Handbook", quizSourceText: null });
    assert.equal("objectPath" in updates, false, "file untouched when no replacement");

    const id = "3f1c2b7a-9d4e-4c1b-8a2f-0e9d8c7b6a51";
    await DocumentController.updateDocument(1, { title: "Handbook", objectPath: `/objects/uploads/${id}`, mimeType: "application/pdf", fileSize: 1200, originalFilename: "new.pdf" });
    assert.equal(updates.objectPath, `/objects/uploads/${id}`);
    assert.equal(updates.originalFilename, "new.pdf");

    updates = null;
    const blank: any = await DocumentController.updateDocument(1, { title: "   " });
    assert.equal(blank.status, 400);
    assert.equal(updates, null);
  } finally {
    (Document.findByPk as any) = originals.find;
    (Document.update as any) = originals.update;
    (DocumentController as any).getDocument = originals.get;
  }
});
