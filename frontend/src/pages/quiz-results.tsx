import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, Button, Input, Label } from "@/components/shared";
import { apiFetch } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { BarChart3, Filter, RefreshCw, Trophy, X } from "lucide-react";

interface AttemptRow {
  id: number;
  userId: number;
  user: { id: number; name: string; email: string } | null;
  documentId: number;
  document: { id: number; title: string; category: string } | null;
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  completedAt: string;
}

interface AttemptsResponse {
  data: AttemptRow[];
  summary: { count: number; avgPercent: number; passCount: number; passRate: number } | null;
  isAdminView: boolean;
}

interface AttemptDetail {
  id: number;
  user: { id: number; name: string; email: string } | null;
  document: { id: number; title: string; category: string } | null;
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  completedAt: string;
  answers: {
    questionId: number;
    correct: boolean;
    correctIndex: number | null;
    yourIndex: number;
    questionText: string | null;
    choices: string[];
  }[];
}

export default function QuizResults() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [resp, setResp] = useState<AttemptsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterDoc, setFilterDoc] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const [detail, setDetail] = useState<AttemptDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function load() {
    setLoading(true); setError(null);
    const params = new URLSearchParams();
    if (filterDoc) params.set("documentId", filterDoc);
    if (filterUser && isAdmin) params.set("userId", filterUser);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);
    const r = await apiFetch(`/api/quiz/attempts?${params.toString()}`);
    setLoading(false);
    if (!r.ok) { setError("Could not load results"); return; }
    setResp(await r.json());
  }
  useEffect(() => { load(); }, []);

  async function openDetail(id: number) {
    setDetailLoading(true);
    const r = await apiFetch(`/api/quiz/attempts/${id}`);
    setDetailLoading(false);
    if (!r.ok) return;
    setDetail(await r.json());
  }

  const docOptions = useMemo(() => {
    const seen = new Map<number, string>();
    resp?.data.forEach(a => { if (a.document) seen.set(a.document.id, a.document.title); });
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [resp]);

  const userOptions = useMemo(() => {
    if (!isAdmin) return [];
    const seen = new Map<number, string>();
    resp?.data.forEach(a => { if (a.user) seen.set(a.user.id, a.user.name || a.user.email); });
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [resp, isAdmin]);

  function clearFilters() {
    setFilterDoc(""); setFilterUser(""); setFilterFrom(""); setFilterTo("");
    setTimeout(load, 0);
  }

  return (
    <div>
      <PageHeader
        title={isAdmin ? "Quiz Results — Master Table" : "My Quiz Results"}
        description={isAdmin
          ? "Every quiz attempt across the company. Use the filters to drill in by user, document, or date."
          : "All your past quiz attempts and scores."}
        action={<Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4 mr-1.5" /> Refresh</Button>}
      />

      {resp?.summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center"><BarChart3 className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{resp.summary.count}</p>
                <p className="text-xs text-muted-foreground">Total attempts</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center"><BarChart3 className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold">{resp.summary.avgPercent}%</p>
                <p className="text-xs text-muted-foreground">Average score</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"><Trophy className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <p className="text-2xl font-bold">{resp.summary.passRate}%</p>
                <p className="text-xs text-muted-foreground">Pass rate ({resp.summary.passCount} passed)</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Card className="mb-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-medium"><Filter className="h-4 w-4" /> Filters</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {isAdmin && (
            <div>
              <Label>User</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm w-full mt-1" value={filterUser} onChange={e => setFilterUser(e.target.value)}>
                <option value="">All users</option>
                {userOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
          )}
          <div>
            <Label>Document</Label>
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm w-full mt-1" value={filterDoc} onChange={e => setFilterDoc(e.target.value)}>
              <option value="">All documents</option>
              {docOptions.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
            </select>
          </div>
          <div><Label>From</Label><Input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="mt-1" /></div>
          <div><Label>To</Label><Input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="mt-1" /></div>
          <div className="flex items-end gap-2">
            <Button onClick={load} disabled={loading}>Apply</Button>
            <Button variant="outline" onClick={clearFilters}>Clear</Button>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="p-6 text-sm text-destructive">{error}</div>
        ) : !resp?.data.length ? (
          <div className="p-6 text-sm text-muted-foreground">No quiz attempts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr className="text-left">
                  {isAdmin && <th className="px-4 py-2 font-medium">User</th>}
                  <th className="px-4 py-2 font-medium">Document</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium text-right">Score</th>
                  <th className="px-4 py-2 font-medium text-right">%</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Completed</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {resp.data.map(a => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-muted/20">
                    {isAdmin && (
                      <td className="px-4 py-2">
                        <div className="font-medium">{a.user?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{a.user?.email ?? ""}</div>
                      </td>
                    )}
                    <td className="px-4 py-2">{a.document?.title ?? `#${a.documentId}`}</td>
                    <td className="px-4 py-2"><span className="text-xs px-1.5 py-0.5 rounded bg-muted">{a.document?.category ?? "—"}</span></td>
                    <td className="px-4 py-2 text-right font-mono">{a.score}/{a.total}</td>
                    <td className="px-4 py-2 text-right font-mono">{a.percent}%</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${a.passed ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                        {a.passed ? "Passed" : "Below pass"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{new Date(a.completedAt).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => openDetail(a.id)}>View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {detail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-background rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-background">
              <div>
                <h2 className="font-semibold">{detail.document?.title}</h2>
                <p className="text-xs text-muted-foreground">
                  {detail.user?.name} · {detail.percent}% ({detail.score}/{detail.total}) · {new Date(detail.completedAt).toLocaleString()}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setDetail(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="p-4 space-y-3">
              {detail.answers.map((a, idx) => (
                <div key={idx} className={`rounded-md border p-3 ${a.correct ? "border-emerald-200 dark:border-emerald-900" : "border-rose-200 dark:border-rose-900"}`}>
                  <p className="font-medium text-sm mb-2">Q{idx + 1}. {a.questionText ?? "(question deleted)"}</p>
                  <ul className="space-y-1 text-sm">
                    {a.choices.map((c, i) => (
                      <li key={i} className={`flex items-center gap-2 ${a.correctIndex === i ? "text-emerald-700 dark:text-emerald-400 font-medium" : a.yourIndex === i ? "text-rose-700 dark:text-rose-400" : "text-muted-foreground"}`}>
                        {a.correctIndex === i ? "✓" : a.yourIndex === i ? "✗" : "·"} {c}
                        {a.yourIndex === i && <span className="text-xs">(answer)</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {detailLoading && <div className="fixed bottom-4 right-4 text-xs bg-background border rounded px-3 py-1 shadow">Loading…</div>}
    </div>
  );
}
