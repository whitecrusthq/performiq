import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, Button, Input, Label } from "@/components/shared";
import { apiFetch } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { BarChart3, Filter, RefreshCw, Trophy, X, Search, Download, CheckCircle2, XCircle, FileText, Calendar, Eye } from "lucide-react";

interface AttemptRow {
  id: number;
  userId: number;
  user: { id: number; name: string; email: string } | null;
  siteId: number | null;
  site: string | null;
  department: string | null;
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
  const [filterSite, setFilterSite] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [search, setSearch] = useState("");

  const [sites, setSites] = useState<{ id: number; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);

  const [detail, setDetail] = useState<AttemptDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);

  async function load() {
    setLoading(true); setError(null);
    const params = new URLSearchParams();
    if (filterDoc) params.set("documentId", filterDoc);
    if (filterUser && isAdmin) params.set("userId", filterUser);
    if (filterSite && isAdmin) params.set("siteId", filterSite);
    if (filterDept && isAdmin) params.set("department", filterDept);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);
    const r = await apiFetch(`/api/quiz/attempts?${params.toString()}`);
    setLoading(false);
    if (!r.ok) { setError("Could not load results"); return; }
    setResp(await r.json());
  }
  // Re-fetch whenever Apply or Clear bumps the reload key (also runs on mount).
  useEffect(() => { load(); }, [reloadKey]);

  useEffect(() => {
    if (!isAdmin) return;
    apiFetch("/api/sites").then(r => r.ok ? r.json() : []).then(setSites).catch(() => {});
    apiFetch("/api/departments").then(r => r.ok ? r.json() : []).then(setDepartments).catch(() => {});
  }, [isAdmin]);

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
    setFilterDoc(""); setFilterUser(""); setFilterSite(""); setFilterDept("");
    setFilterFrom(""); setFilterTo(""); setSearch("");
    setReloadKey(k => k + 1);
  }

  const filteredRows = useMemo(() => {
    if (!resp?.data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return resp.data;
    return resp.data.filter(a =>
      (a.user?.name ?? "").toLowerCase().includes(q) ||
      (a.user?.email ?? "").toLowerCase().includes(q) ||
      (a.document?.title ?? "").toLowerCase().includes(q) ||
      (a.document?.category ?? "").toLowerCase().includes(q) ||
      (a.site ?? "").toLowerCase().includes(q) ||
      (a.department ?? "").toLowerCase().includes(q)
    );
  }, [resp, search]);

  const activeFilterCount =
    (filterDoc ? 1 : 0) + (filterUser ? 1 : 0) + (filterSite ? 1 : 0) +
    (filterDept ? 1 : 0) + (filterFrom ? 1 : 0) + (filterTo ? 1 : 0);

  function exportCSV() {
    if (!filteredRows.length) return;
    const headers = isAdmin
      ? ["User", "Email", "Site", "Department", "Document", "Category", "Score", "Total", "Percent", "Passed", "Completed"]
      : ["Document", "Category", "Score", "Total", "Percent", "Passed", "Completed"];
    const rows = filteredRows.map(a => {
      const base = [
        a.document?.title ?? `#${a.documentId}`,
        a.document?.category ?? "",
        String(a.score),
        String(a.total),
        `${a.percent}%`,
        a.passed ? "Yes" : "No",
        new Date(a.completedAt).toISOString(),
      ];
      if (!isAdmin) return base;
      return [
        a.user?.name ?? "",
        a.user?.email ?? "",
        a.site ?? "",
        a.department ?? "",
        ...base,
      ];
    });
    const escape = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    const csv = [headers, ...rows].map(r => r.map(escape).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quiz-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title={isAdmin ? "Quiz Results — Master Table" : "My Quiz Results"}
        description={isAdmin
          ? "Every quiz attempt across the company. Use the filters to drill in by user, document, or date."
          : "All your past quiz attempts and scores."}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={exportCSV} disabled={!filteredRows.length}>
              <Download className="h-4 w-4 mr-1.5" /> Export CSV
            </Button>
            <Button variant="outline" onClick={() => setReloadKey(k => k + 1)} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
            </Button>
          </div>
        }
      />

      {resp?.summary && (() => {
        const useFiltered = !!search.trim();
        const count = useFiltered ? filteredRows.length : resp.summary.count;
        const avg = useFiltered
          ? (filteredRows.length ? Math.round(filteredRows.reduce((s, a) => s + a.percent, 0) / filteredRows.length) : 0)
          : resp.summary.avgPercent;
        const passCount = useFiltered ? filteredRows.filter(a => a.passed).length : resp.summary.passCount;
        const passRate = useFiltered
          ? (filteredRows.length ? Math.round((passCount / filteredRows.length) * 100) : 0)
          : resp.summary.passRate;
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card className="p-4 text-center">
              <BarChart3 className="w-6 h-6 text-blue-600 mx-auto mb-1" />
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs text-muted-foreground">{useFiltered ? "Matching attempts" : "Total attempts"}</p>
            </Card>
            <Card className="p-4 text-center">
              <Trophy className="w-6 h-6 text-amber-600 mx-auto mb-1" />
              <p className="text-2xl font-bold">{avg}%</p>
              <p className="text-xs text-muted-foreground">Average score</p>
            </Card>
            <Card className="p-4 text-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
              <p className="text-2xl font-bold">{passRate}%</p>
              <p className="text-xs text-muted-foreground">Pass rate ({passCount} passed)</p>
            </Card>
          </div>
        );
      })()}

      <div className="mb-4 relative max-w-xl">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search results by user, document, category, site or department…"
          className="w-full pl-9 pr-9 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:bg-muted">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Filter className="h-4 w-4" /> Filters
            {activeFilterCount > 0 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                {activeFilterCount} active
              </span>
            )}
          </div>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
              Clear all
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {isAdmin && (
            <div>
              <Label>User</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm w-full mt-1" value={filterUser} onChange={e => setFilterUser(e.target.value)}>
                <option value="">All users</option>
                {userOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
          )}
          {isAdmin && (
            <div>
              <Label>Site</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm w-full mt-1" value={filterSite} onChange={e => setFilterSite(e.target.value)}>
                <option value="">All sites</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          {isAdmin && (
            <div>
              <Label>Department</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm w-full mt-1" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                <option value="">All departments</option>
                {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
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
            <Button onClick={() => setReloadKey(k => k + 1)} disabled={loading}>Apply</Button>
            <Button variant="outline" onClick={clearFilters}>Clear</Button>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="p-12 flex justify-center">
          <div className="animate-spin w-6 h-6 border-3 border-primary border-t-transparent rounded-full" />
        </Card>
      ) : error ? (
        <Card className="p-6 text-sm text-destructive">{error}</Card>
      ) : !resp?.data.length ? (
        <Card className="p-12 text-center">
          <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-medium text-sm">No quiz attempts found</p>
          <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters above.</p>
        </Card>
      ) : !filteredRows.length ? (
        <Card className="p-12 text-center">
          <Search className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-medium text-sm">No results match "{search}"</p>
          <button onClick={() => setSearch("")} className="text-xs text-primary hover:underline mt-2">
            Clear search
          </button>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredRows.map(a => {
            const initials = a.user?.name
              ? a.user.name.split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
              : "—";
            const accent = a.passed
              ? "bg-emerald-100 text-emerald-700"
              : "bg-rose-100 text-rose-700";
            return (
              <Card
                key={a.id}
                className="p-3 cursor-pointer hover:shadow-md transition-all"
                onClick={() => openDetail(a.id)}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {isAdmin ? (
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {initials}
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      {isAdmin && (
                        <p className="font-semibold text-sm truncate">{a.user?.name ?? "—"}</p>
                      )}
                      <p className={`${isAdmin ? "text-xs text-muted-foreground" : "font-semibold text-sm"} truncate flex items-center gap-1.5`}>
                        {!isAdmin && <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                        {isAdmin ? (a.user?.email ?? "") : (a.document?.title ?? `#${a.documentId}`)}
                      </p>
                    </div>
                  </div>

                  <div className="hidden md:flex items-center gap-2 min-w-0 flex-1">
                    {isAdmin && (
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Document</p>
                        <p className="text-sm font-medium truncate">{a.document?.title ?? `#${a.documentId}`}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {a.document?.category && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {a.document.category}
                      </span>
                    )}
                    {isAdmin && a.site && (
                      <span className="hidden lg:inline text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                        {a.site}
                      </span>
                    )}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span className="hidden sm:inline">{new Date(a.completedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="text-sm font-mono font-semibold w-14 text-right">{a.percent}%</div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${accent}`}>
                      {a.passed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {a.passed ? "Passed" : "Failed"}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); openDetail(a.id); }}
                      className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="View details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

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
