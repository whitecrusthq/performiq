import test from "node:test";
import assert from "node:assert/strict";
import QuizController from "./QuizController.js";
import AppSettings from "../models/AppSettings.js";
import Document from "../models/Document.js";
import DocumentQuestion from "../models/DocumentQuestion.js";

function stubSettings(initial: number) {
  const originals = { find: AppSettings.findByPk, foc: AppSettings.findOrCreate };
  const row: any = { quizSecondsPerQuestion: initial, update: async (v: any) => Object.assign(row, v) };
  (AppSettings.findByPk as any) = async () => row;
  (AppSettings.findOrCreate as any) = async () => [row, false];
  return { row, restore: () => { (AppSettings.findByPk as any) = originals.find; (AppSettings.findOrCreate as any) = originals.foc; } };
}

test("quiz timer: saves 0 (off) and values within 5–600 seconds", async () => {
  const { row, restore } = stubSettings(0);
  try {
    assert.deepEqual(await QuizController.updateSettings({ secondsPerQuestion: 30 }), { data: { secondsPerQuestion: 30 } });
    assert.equal(row.quizSecondsPerQuestion, 30);
    assert.deepEqual(await QuizController.getSettings(), { secondsPerQuestion: 30 });
    assert.deepEqual(await QuizController.updateSettings({ secondsPerQuestion: 0 }), { data: { secondsPerQuestion: 0 } });
    assert.equal(row.quizSecondsPerQuestion, 0);
  } finally { restore(); }
});

test("quiz timer: refuses fractions, negatives, out-of-range and non-numbers", async () => {
  const { row, restore } = stubSettings(20);
  try {
    for (const bad of [4, 601, -5, 12.5, "abc", "30", null, undefined]) {
      const r: any = await QuizController.updateSettings({ secondsPerQuestion: bad });
      assert.equal(r.status, 400, `expected 400 for ${String(bad)}`);
      assert.match(r.error, /0 \(no limit\)/);
    }
    assert.equal(row.quizSecondsPerQuestion, 20);
  } finally { restore(); }
});

test("quiz timer: the take payload carries the timer and never the answers", async () => {
  const { restore } = stubSettings(15);
  const originals = { doc: Document.findByPk, q: DocumentQuestion.findAll };
  (Document.findByPk as any) = async () => ({ toJSON: () => ({ id: 1, title: "Leave", category: "policy" }) });
  (DocumentQuestion.findAll as any) = async () => [{ id: 9, question: "Q?", choices: ["a", "b"], correctIndex: 1 }];
  try {
    const r: any = await QuizController.getQuiz(1);
    assert.equal(r.data.secondsPerQuestion, 15);
    assert.deepEqual(r.data.questions, [{ id: 9, question: "Q?", choices: ["a", "b"] }]);
  } finally {
    restore();
    (Document.findByPk as any) = originals.doc;
    (DocumentQuestion.findAll as any) = originals.q;
  }
});
