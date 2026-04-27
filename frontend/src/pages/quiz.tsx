import { useEffect, useState } from "react";
import { PageHeader, Card, Button } from "@/components/shared";
import { apiFetch } from "@/lib/utils";
import { Brain, Check, X, RotateCcw, Trophy, FileText, Sparkles } from "lucide-react";

interface QuizQuestion {
  id: number;
  question: string;
  choices: string[];
  documentId: number;
  document: { id: number; title: string; category: string } | null;
}

interface QuizResult {
  score: number;
  total: number;
  percent: number;
  results: { questionId: number; correct: boolean; correctIndex: number | null; yourIndex: number }[];
}

export default function Quiz() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [count, setCount] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  async function startQuiz() {
    setLoading(true);
    setResult(null);
    setAnswers({});
    setError(null);
    try {
      const r = await apiFetch(`/api/quiz/random?count=${count}`);
      if (!r.ok) { setError("Could not load quiz"); return; }
      const list = await r.json();
      if (!Array.isArray(list) || list.length === 0) {
        setError("No quiz questions are available yet. An admin needs to add questions to handbook documents first.");
        setQuestions([]);
        return;
      }
      setQuestions(list);
      setStarted(true);
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (Object.keys(answers).length < questions.length) {
      if (!confirm("You haven't answered every question. Submit anyway?")) return;
    }
    const payload = questions.map(q => ({
      questionId: q.id,
      answerIndex: answers[q.id] ?? -1,
    }));
    const r = await apiFetch("/api/quiz/submit", { method: "POST", body: JSON.stringify({ answers: payload }) });
    if (!r.ok) { setError("Submission failed"); return; }
    setResult(await r.json());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setStarted(false);
    setResult(null);
    setAnswers({});
    setQuestions([]);
  }

  if (!started) {
    return (
      <div>
        <PageHeader
          title="Knowledge Quiz"
          description="Test your understanding of company policies. Questions are randomly drawn from the staff handbook."
        />
        <Card className="max-w-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Ready to start?</h2>
              <p className="text-sm text-muted-foreground">Pick how many questions you'd like.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm">Questions:</label>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={count}
              onChange={e => setCount(Number(e.target.value))}
            >
              {[5, 10, 15, 20, 30].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          {error && <p className="text-sm text-destructive mb-3">{error}</p>}
          <Button onClick={startQuiz} disabled={loading}>
            {loading ? "Loading…" : <><Sparkles className="h-4 w-4 mr-2" /> Start quiz</>}
          </Button>
        </Card>
      </div>
    );
  }

  if (result) {
    const passed = result.percent >= 70;
    return (
      <div>
        <PageHeader title="Quiz results" description="Review your answers below." />
        <Card className={`mb-6 border-2 ${passed ? "border-emerald-500/50" : "border-amber-500/50"}`}>
          <div className="flex items-center gap-4">
            <div className={`h-14 w-14 rounded-full flex items-center justify-center ${passed ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`}>
              <Trophy className={`h-7 w-7 ${passed ? "text-emerald-600" : "text-amber-600"}`} />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold">{result.percent}%</h2>
              <p className="text-sm text-muted-foreground">
                {result.score} out of {result.total} correct · {passed ? "Well done!" : "Keep learning!"}
              </p>
            </div>
            <Button variant="outline" onClick={reset}><RotateCcw className="h-4 w-4 mr-2" /> Try another</Button>
          </div>
        </Card>

        <div className="space-y-3">
          {questions.map((q, idx) => {
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
                {q.document && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <FileText className="h-3 w-3" /> From: {q.document.title} · {q.document.category}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  const answered = Object.keys(answers).length;
  return (
    <div>
      <PageHeader
        title="Knowledge Quiz"
        description={`${answered} of ${questions.length} answered`}
        action={<Button variant="outline" onClick={reset}>Cancel</Button>}
      />
      <div className="space-y-3">
        {questions.map((q, idx) => (
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
            {q.document && (
              <p className="text-xs text-muted-foreground mt-2 ml-6 flex items-center gap-1">
                <FileText className="h-3 w-3" /> {q.document.title} · {q.document.category}
              </p>
            )}
          </Card>
        ))}
      </div>
      <div className="mt-6 flex justify-end gap-2 sticky bottom-4">
        <Button onClick={submit} size="lg">Submit quiz</Button>
      </div>
    </div>
  );
}
