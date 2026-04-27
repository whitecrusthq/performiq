import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, Button } from "@/components/shared";
import { apiFetch } from "@/lib/utils";
import {
  Brain, Check, X, RotateCcw, Trophy, FileText, Sparkles,
  CheckCircle2, Circle, ArrowRight, AlertCircle, BookOpen,
} from "lucide-react";

interface OverviewItem {
  documentId: number;
  title: string;
  category: string;
  description: string | null;
  questionCount: number;
  latestAttempt: {
    id: number;
    score: number;
    total: number;
    percent: number;
    passed: boolean;
    completedAt: string;
  } | null;
}

interface TakeQuestion { id: number; question: string; choices: string[]; }
interface TakeData {
  document: { id: number; title: string; category: string };
  questions: TakeQuestion[];
}

interface ResultData {
  attemptId: number;
  documentId: number;
  documentTitle: string;
  category: string;
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  threshold: number;
  results: { questionId: number; correct: boolean; correctIndex: number | null; yourIndex: number }[];
}

type Mode = "overview" | "taking" | "result";

export default function Quiz() {
  const [overview, setOverview] = useState<OverviewItem[]>([]);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("overview");
  const [take, setTake] = useState<TakeData | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [takeError, setTakeError] = useState<string | null>(null);

  const [result, setResult] = useState<ResultData | null>(null);

  async function loadOverview() {
    setLoadingOverview(true);
    setOverviewError(null);
    try {
      const r = await apiFetch("/api/quiz/overview");
      if (!r.ok) { setOverviewError("Could not load quizzes"); return; }
      setOverview(await r.json());
    } finally { setLoadingOverview(false); }
  }
  useEffect(() => { loadOverview(); }, []);

  const orderedQueue = useMemo(() => overview, [overview]);

  function findNextNotCompleted(afterDocId?: number): OverviewItem | null {
    const list = orderedQueue;
    if (afterDocId == null) {
      return list.find(d => !d.latestAttempt) ?? null;
    }
    const idx = list.findIndex(d => d.documentId === afterDocId);
    for (let i = idx + 1; i < list.length; i++) {
      if (!list[i].latestAttempt) return list[i];
    }
    for (let i = 0; i < list.length; i++) {
      if (!list[i].latestAttempt && list[i].documentId !== afterDocId) return list[i];
    }
    return null;
  }

  async function startQuiz(documentId: number) {
    setTakeError(null);
    setAnswers({});
    setResult(null);
    const r = await apiFetch(`/api/quiz/documents/${documentId}/take`);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setTakeError(j?.error ?? "Could not load quiz");
      return;
    }
    setTake(await r.json());
    setMode("taking");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitQuiz() {
    if (!take) return;
    if (Object.keys(answers).length < take.questions.length) {
      if (!confirm("You haven't answered every question. Submit anyway?")) return;
    }
    setSubmitting(true);
    const payload = take.questions.map(q => ({
      questionId: q.id,
      answerIndex: answers[q.id] ?? -1,
    }));
    const r = await apiFetch(`/api/quiz/documents/${take.document.id}/submit`, {
      method: "POST",
      body: JSON.stringify({ answers: payload }),
    });
    setSubmitting(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setTakeError(j?.error ?? "Submission failed");
      return;
    }
    const data: ResultData = await r.json();
    setResult(data);
    setMode("result");
    loadOverview();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function backToOverview() {
    setMode("overview");
    setTake(null);
    setResult(null);
    setAnswers({});
    setTakeError(null);
  }

  function nextQuiz() {
    if (!result) { backToOverview(); return; }
    const next = findNextNotCompleted(result.documentId);
    if (!next) { backToOverview(); return; }
    startQuiz(next.documentId);
  }

  // -------- Overview --------
  if (mode === "overview") {
    if (loadingOverview) {
      return (
        <div>
          <PageHeader title="Knowledge Quiz" description="Step through each handbook quiz, in order." />
          <Card><p className="text-sm text-muted-foreground">Loading…</p></Card>
        </div>
      );
    }
    if (overviewError) {
      return (
        <div>
          <PageHeader title="Knowledge Quiz" />
          <Card><p className="text-sm text-destructive">{overviewError}</p></Card>
        </div>
      );
    }
    if (overview.length === 0) {
      return (
        <div>
          <PageHeader title="Knowledge Quiz" description="Step through each handbook quiz, in order." />
          <Card>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">No quizzes available yet</p>
                <p className="text-sm text-muted-foreground">An admin needs to add questions to handbook documents first.</p>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    const completed = overview.filter(d => d.latestAttempt).length;
    const allDone = completed === overview.length;
    const nextDoc = findNextNotCompleted();

    return (
      <div>
        <PageHeader
          title="Knowledge Quiz"
          description="Complete each handbook quiz in order. You'll see your score after each one before moving on."
        />

        <Card className="mb-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              {allDone ? <Trophy className="h-6 w-6 text-primary" /> : <Brain className="h-6 w-6 text-primary" />}
            </div>
            <div className="flex-1">
              <p className="font-semibold">{completed} of {overview.length} quizzes completed</p>
              <div className="h-2 bg-muted rounded-full overflow-hidden mt-2 max-w-md">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${overview.length ? (completed / overview.length) * 100 : 0}%` }}
                />
              </div>
            </div>
            {nextDoc && (
              <Button onClick={() => startQuiz(nextDoc.documentId)}>
                <Sparkles className="h-4 w-4 mr-2" />
                {completed === 0 ? "Start first quiz" : "Continue"}
              </Button>
            )}
            {allDone && (
              <span className="text-sm text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> All done!
              </span>
            )}
          </div>
        </Card>

        {takeError && <Card className="mb-3 border-destructive/40"><p className="text-sm text-destructive flex items-center gap-2"><AlertCircle className="h-4 w-4" /> {takeError}</p></Card>}

        <div className="space-y-2">
          {overview.map((d, idx) => {
            const a = d.latestAttempt;
            const done = !!a;
            return (
              <Card key={d.documentId} className="hover:border-primary/40 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center w-8">
                    {done
                      ? <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                      : <Circle className="h-6 w-6 text-muted-foreground" />}
                    <span className="text-xs text-muted-foreground mt-1">#{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted">{d.category}</span>
                      <h3 className="font-semibold truncate">{d.title}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {d.questionCount} question{d.questionCount === 1 ? "" : "s"}
                      {a && (
                        <> · last score <span className={a.passed ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>{a.percent}%</span> on {new Date(a.completedAt).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={done ? "outline" : "default"}
                    onClick={() => startQuiz(d.documentId)}
                  >
                    {done ? <><RotateCcw className="h-4 w-4 mr-1.5" /> Retake</> : <><ArrowRight className="h-4 w-4 mr-1.5" /> Start</>}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // -------- Taking --------
  if (mode === "taking" && take) {
    const answered = Object.keys(answers).length;
    return (
      <div>
        <PageHeader
          title={take.document.title}
          description={`${take.document.category} · ${answered} of ${take.questions.length} answered`}
          action={<Button variant="outline" onClick={backToOverview}>Cancel</Button>}
        />
        {takeError && <Card className="mb-3 border-destructive/40"><p className="text-sm text-destructive">{takeError}</p></Card>}
        <div className="space-y-3">
          {take.questions.map((q, idx) => (
            <Card key={q.id}>
              <div className="flex items-start gap-2 mb-3">
                <span className="text-xs font-mono text-muted-foreground mt-0.5">Q{idx + 1}</span>
                <p className="font-medium flex-1">{q.question}</p>
              </div>
              <div className="space-y-1.5 ml-6">
                {q.choices.map((c, i) => (
                  <label key={i} className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${answers[q.id] === i ? "border-primary bg-primary/5" : "border-input hover:bg-accent"}`}>
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      checked={answers[q.id] === i}
                      onChange={() => setAnswers(prev => ({ ...prev, [q.id]: i }))}
                    />
                    <span className="text-sm">{c}</span>
                  </label>
                ))}
              </div>
            </Card>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-2 sticky bottom-4">
          <Button onClick={submitQuiz} size="lg" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit quiz"}
          </Button>
        </div>
      </div>
    );
  }

  // -------- Result --------
  if (mode === "result" && result) {
    const next = findNextNotCompleted(result.documentId);
    return (
      <div>
        <PageHeader title="Quiz results" description={result.documentTitle} />
        <Card className={`mb-6 border-2 ${result.passed ? "border-emerald-500/50" : "border-amber-500/50"}`}>
          <div className="flex items-center gap-4 flex-wrap">
            <div className={`h-14 w-14 rounded-full flex items-center justify-center ${result.passed ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`}>
              <Trophy className={`h-7 w-7 ${result.passed ? "text-emerald-600" : "text-amber-600"}`} />
            </div>
            <div className="flex-1 min-w-[200px]">
              <h2 className="text-2xl font-bold">{result.percent}%</h2>
              <p className="text-sm text-muted-foreground">
                {result.score} out of {result.total} correct ·{" "}
                {result.passed ? "Passed!" : `Below pass mark (${result.threshold}%)`}
              </p>
            </div>
            <Button variant="outline" onClick={backToOverview}>Back to overview</Button>
            {next ? (
              <Button onClick={nextQuiz}>Next quiz <ArrowRight className="h-4 w-4 ml-1.5" /></Button>
            ) : (
              <span className="text-sm text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> All quizzes complete
              </span>
            )}
          </div>
        </Card>

        <div className="space-y-3">
          {take?.questions.map((q, idx) => {
            const r = result.results.find(x => x.questionId === q.id);
            const correct = r?.correct ?? false;
            return (
              <Card key={q.id} className={correct ? "border-emerald-200 dark:border-emerald-900" : "border-rose-200 dark:border-rose-900"}>
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-xs font-mono text-muted-foreground mt-0.5">Q{idx + 1}</span>
                  {correct ? <Check className="h-4 w-4 text-emerald-600 mt-0.5" /> : <X className="h-4 w-4 text-rose-600 mt-0.5" />}
                  <p className="font-medium flex-1">{q.question}</p>
                </div>
                <ul className="space-y-1 ml-6">
                  {q.choices.map((c, i) => {
                    const isYour = r?.yourIndex === i;
                    const isCorrect = r?.correctIndex === i;
                    return (
                      <li key={i} className={`text-sm flex items-center gap-2 ${isCorrect ? "text-emerald-700 dark:text-emerald-400 font-medium" : isYour ? "text-rose-700 dark:text-rose-400" : "text-muted-foreground"}`}>
                        {isCorrect && <Check className="h-3.5 w-3.5" />}
                        {isYour && !isCorrect && <X className="h-3.5 w-3.5" />}
                        {!isYour && !isCorrect && <span className="w-3.5" />}
                        {c}
                        {isYour && <span className="text-xs">(your answer)</span>}
                      </li>
                    );
                  })}
                </ul>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <FileText className="h-3 w-3" /> From: {result.documentTitle} · {result.category}
                </p>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
