import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, Button, Input, Label } from "@/components/shared";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/utils";
import {
  BookOpen, Upload, FileText, Trash2, Sparkles, Plus, X, Check, Search,
  Filter, FolderOpen, ExternalLink, Edit2, HelpCircle,
} from "lucide-react";

interface Doc {
  id: number;
  title: string;
  description: string | null;
  category: string;
  objectPath: string;
  mimeType: string | null;
  fileSize: number | null;
  originalFilename: string | null;
  quizSourceText: string | null;
  uploadedBy: number;
  createdAt: string;
  uploader?: { id: number; name: string; email: string } | null;
  questionCount?: number;
}

interface Question {
  id: number;
  documentId: number;
  question: string;
  choices: string[];
  correctIndex: number;
  source: string;
  createdAt: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  HR: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  IT: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  ESG: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  Finance: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  Operations: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  Compliance: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "Health & Safety": "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  Other: "bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300",
};

function formatBytes(n: number | null): string {
  if (!n || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fileURL(objectPath: string): string {
  const base = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  if (!objectPath.startsWith("/objects/")) return objectPath;
  const id = objectPath.slice("/objects/uploads/".length);
  return `${base}/api/storage/objects/${id}`;
}

export default function Handbook() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [docs, setDocs] = useState<Doc[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const [showUpload, setShowUpload] = useState(false);
  const [editing, setEditing] = useState<Doc | null>(null);
  const [managing, setManaging] = useState<Doc | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const [dRes, cRes] = await Promise.all([
        apiFetch("/api/documents"),
        apiFetch("/api/documents/categories"),
      ]);
      if (dRes.ok) setDocs(await dRes.json());
      if (cRes.ok) setCategories(await cRes.json());
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter(d => {
      if (filterCategory !== "all" && d.category !== filterCategory) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        (d.description ?? "").toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
      );
    });
  }, [docs, filterCategory, search]);

  const grouped = useMemo(() => {
    const map: Record<string, Doc[]> = {};
    filtered.forEach(d => { (map[d.category] ||= []).push(d); });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div>
      <PageHeader
        title="Staff Handbook"
        description="Company policies and reference documents organised by area."
        action={
          isAdmin && (
            <Button onClick={() => setShowUpload(true)}>
              <Upload className="h-4 w-4 mr-2" /> Upload document
            </Button>
          )
        }
      />

      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by title, description or category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="all">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card><p className="text-sm text-muted-foreground">Loading…</p></Card>
      ) : grouped.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <BookOpen className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">No documents yet</p>
            <p className="text-sm text-muted-foreground">
              {isAdmin ? "Upload your first policy document to get started." : "Check back soon."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([cat, list]) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold">{cat}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.Other}`}>
                  {list.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {list.map(d => (
                  <Card key={d.id} className="flex flex-col">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <h3 className="font-medium truncate">{d.title}</h3>
                          <p className="text-xs text-muted-foreground">
                            {d.originalFilename ?? "document"} · {formatBytes(d.fileSize)}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${CATEGORY_COLORS[d.category] ?? CATEGORY_COLORS.Other}`}>
                        {d.category}
                      </span>
                    </div>
                    {d.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{d.description}</p>
                    )}
                    <div className="text-xs text-muted-foreground mb-3">
                      Uploaded {new Date(d.createdAt).toLocaleDateString()} by {d.uploader?.name ?? "—"}
                      {typeof d.questionCount === "number" && d.questionCount > 0 && (
                        <> · <span className="inline-flex items-center gap-1"><HelpCircle className="h-3 w-3" />{d.questionCount} quiz Q</span></>
                      )}
                    </div>
                    <div className="mt-auto flex flex-wrap gap-2">
                      <a
                        href={fileURL(d.objectPath)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-accent"
                      >
                        <ExternalLink className="h-3 w-3" /> Open
                      </a>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => setEditing(d)}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-accent"
                          >
                            <Edit2 className="h-3 w-3" /> Edit
                          </button>
                          <button
                            onClick={() => setManaging(d)}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-accent"
                          >
                            <HelpCircle className="h-3 w-3" /> Quiz Q
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm("Delete this document? Its quiz questions will also be removed.")) return;
                              const r = await apiFetch(`/api/documents/${d.id}`, { method: "DELETE" });
                              if (r.ok) refresh(); else alert((await r.json()).error ?? "Delete failed");
                            }}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        </>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showUpload && (
        <UploadDialog
          categories={categories}
          onClose={() => setShowUpload(false)}
          onSaved={() => { setShowUpload(false); refresh(); }}
        />
      )}

      {editing && (
        <EditDialog
          doc={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}

      {managing && (
        <ManageQuestionsDialog
          doc={managing}
          onClose={() => { setManaging(null); refresh(); }}
        />
      )}
    </div>
  );
}

function UploadDialog({
  categories, onClose, onSaved,
}: { categories: string[]; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "Other");
  const [quizSourceText, setQuizSourceText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!title.trim()) { setErr("Title is required"); return; }
    if (!file) { setErr("Choose a file to upload"); return; }
    setBusy(true);
    try {
      const r1 = await apiFetch("/api/storage/uploads/request-url", { method: "POST" });
      if (!r1.ok) { setErr((await r1.json()).error ?? "Could not get upload URL"); setBusy(false); return; }
      const { uploadURL, objectPath } = await r1.json();
      const put = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
      if (!put.ok) { setErr(`Upload failed: ${put.status}`); setBusy(false); return; }
      const r2 = await apiFetch("/api/documents", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          category,
          objectPath,
          mimeType: file.type || null,
          fileSize: file.size,
          originalFilename: file.name,
          quizSourceText: quizSourceText.trim() || null,
        }),
      });
      if (!r2.ok) { setErr((await r2.json()).error ?? "Save failed"); setBusy(false); return; }
      onSaved();
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Upload document" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Title"><Input value={title} onChange={e => setTitle(e.target.value)} /></Field>
        <Field label="Category">
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm w-full" value={category} onChange={e => setCategory(e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Description (optional)">
          <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[70px]" value={description} onChange={e => setDescription(e.target.value)} />
        </Field>
        <Field label="File (PDF, DOCX, etc.)">
          <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
        </Field>
        <Field label="Quiz reference text (optional — used by the AI question generator)">
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono"
            placeholder="Paste a paragraph or two from the document so the AI can generate quiz questions from it."
            value={quizSourceText}
            onChange={e => setQuizSourceText(e.target.value)}
          />
        </Field>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Uploading…" : "Upload"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function EditDialog({
  doc, categories, onClose, onSaved,
}: { doc: Doc; categories: string[]; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(doc.title);
  const [description, setDescription] = useState(doc.description ?? "");
  const [category, setCategory] = useState(doc.category);
  const [quizSourceText, setQuizSourceText] = useState(doc.quizSourceText ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true); setErr(null);
    const r = await apiFetch(`/api/documents/${doc.id}`, {
      method: "PATCH",
      body: JSON.stringify({ title, description: description || null, category, quizSourceText: quizSourceText || null }),
    });
    setBusy(false);
    if (!r.ok) { setErr((await r.json()).error ?? "Save failed"); return; }
    onSaved();
  }

  return (
    <Modal title="Edit document" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Title"><Input value={title} onChange={e => setTitle(e.target.value)} /></Field>
        <Field label="Category">
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm w-full" value={category} onChange={e => setCategory(e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Description">
          <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[70px]" value={description} onChange={e => setDescription(e.target.value)} />
        </Field>
        <Field label="Quiz reference text">
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono"
            value={quizSourceText}
            onChange={e => setQuizSourceText(e.target.value)}
          />
        </Field>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function ManageQuestionsDialog({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateCount, setGenerateCount] = useState(5);

  // new question form
  const [qText, setQText] = useState("");
  const [choices, setChoices] = useState<string[]>(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);

  async function refresh() {
    setLoading(true);
    const r = await apiFetch(`/api/documents/${doc.id}/questions`);
    if (r.ok) setQuestions(await r.json());
    setLoading(false);
  }
  useEffect(() => { refresh(); }, [doc.id]);

  async function addQuestion() {
    setErr(null);
    const cleaned = choices.map(c => c.trim()).filter(Boolean);
    if (!qText.trim()) { setErr("Question text required"); return; }
    if (cleaned.length < 2) { setErr("Add at least 2 choices"); return; }
    if (correct >= cleaned.length) { setErr("Pick a valid correct answer"); return; }
    setAdding(true);
    const r = await apiFetch(`/api/documents/${doc.id}/questions`, {
      method: "POST",
      body: JSON.stringify({ question: qText, choices: cleaned, correctIndex: correct }),
    });
    setAdding(false);
    if (!r.ok) { setErr((await r.json()).error ?? "Failed"); return; }
    setQText(""); setChoices(["", "", "", ""]); setCorrect(0);
    refresh();
  }

  async function deleteQ(qid: number) {
    if (!confirm("Delete this question?")) return;
    const r = await apiFetch(`/api/documents/${doc.id}/questions/${qid}`, { method: "DELETE" });
    if (r.ok) refresh();
  }

  async function generate() {
    setErr(null);
    setGenerating(true);
    const r = await apiFetch(`/api/documents/${doc.id}/questions/generate`, {
      method: "POST",
      body: JSON.stringify({ count: generateCount }),
    });
    setGenerating(false);
    if (!r.ok) { setErr((await r.json()).error ?? "Generation failed"); return; }
    refresh();
  }

  return (
    <Modal title={`Quiz questions — ${doc.title}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="rounded-md border bg-muted/30 p-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Generate with AI</span>
          </div>
          <input
            type="number"
            min={1}
            max={15}
            value={generateCount}
            onChange={e => setGenerateCount(Math.min(15, Math.max(1, Number(e.target.value) || 5)))}
            className="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm"
          />
          <span className="text-xs text-muted-foreground">questions</span>
          <Button size="sm" onClick={generate} disabled={generating}>
            {generating ? "Generating…" : "Generate"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Uses Google Gemini and the document's "quiz reference text" as the source.
          </span>
        </div>

        <div className="rounded-md border p-3 space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> Add a question manually</h3>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
            placeholder="Question text…"
            value={qText}
            onChange={e => setQText(e.target.value)}
          />
          <div className="space-y-1.5">
            {choices.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={correct === i}
                  onChange={() => setCorrect(i)}
                  title="Mark as correct answer"
                />
                <Input
                  value={c}
                  onChange={e => setChoices(prev => prev.map((p, j) => j === i ? e.target.value : p))}
                  placeholder={`Choice ${i + 1}${i < 2 ? " (required)" : " (optional)"}`}
                />
                {choices.length > 2 && (
                  <button onClick={() => { setChoices(prev => prev.filter((_, j) => j !== i)); if (correct >= i && correct > 0) setCorrect(correct - 1); }}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {choices.length < 6 && (
            <button className="text-xs text-primary" onClick={() => setChoices(prev => [...prev, ""])}>+ Add another choice</button>
          )}
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button size="sm" onClick={addQuestion} disabled={adding}>{adding ? "Adding…" : "Add question"}</Button>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">Existing questions ({questions.length})</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {questions.map(q => (
                <div key={q.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{q.question}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{q.source}</span>
                      <button onClick={() => deleteQ(q.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                    </div>
                  </div>
                  <ul className="mt-1.5 space-y-0.5">
                    {q.choices.map((c, i) => (
                      <li key={i} className={`text-xs flex items-center gap-1.5 ${i === q.correctIndex ? "text-emerald-700 dark:text-emerald-400 font-medium" : "text-muted-foreground"}`}>
                        {i === q.correctIndex && <Check className="h-3 w-3" />}{c}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className={`bg-card rounded-lg shadow-xl w-full ${wide ? "max-w-2xl" : "max-w-md"} my-8`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
