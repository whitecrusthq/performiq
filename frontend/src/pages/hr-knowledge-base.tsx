import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/utils";
import {
  BookOpen, Plus, Trash2, FileText, Search, Upload, Loader2, AlertCircle, Sparkles,
} from "lucide-react";

async function apiFetchJson(url: string, opts: RequestInit = {}) {
  const r = await apiFetch(url, opts);
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error ?? "Request failed");
  }
  return r.json();
}

type KbDoc = {
  id: number;
  title: string;
  sourceFilename: string | null;
  tags: string | null;
  contentLength: number;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function HrKnowledgeBase() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: docs = [], isLoading } = useQuery<KbDoc[]>({
    queryKey: ["hr-kb-documents"],
    queryFn: () => apiFetchJson("/api/hr-kb-documents"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetchJson(`/api/hr-kb-documents/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-kb-documents"] });
      toast({ title: "Document removed" });
      setDeletingId(null);
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const filtered = (docs || []).filter(d => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      d.title.toLowerCase().includes(q) ||
      (d.tags ?? "").toLowerCase().includes(q) ||
      (d.sourceFilename ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="HR Knowledge Base"
        description="Import policy documents and reference material. The AI assistant uses these to draft replies to HR support tickets."
        action={
          <Button onClick={() => setShowAdd(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Add Document
          </Button>
        }
      />

      <div className="rounded-2xl border bg-card">
        <div className="px-4 py-3 border-b flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by title, tag or filename…"
              className="pl-9"
            />
          </div>
          <Badge variant="outline" className="ml-auto gap-1.5">
            <Sparkles className="w-3 h-3" />
            {docs.length} {docs.length === 1 ? "document" : "documents"} available to AI
          </Badge>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
            {docs.length === 0
              ? "No knowledge base documents yet. Add policy text, FAQs or handbook excerpts so the AI can reference them when drafting replies."
              : "No documents match your search."}
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map(d => (
              <div key={d.id} className="px-4 py-3 flex items-start gap-3 hover:bg-muted/40">
                <div className="mt-0.5 p-2 rounded-lg bg-primary/10 text-primary">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{d.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-2">
                    <span>{(d.contentLength / 1000).toFixed(1)}k chars</span>
                    {d.sourceFilename && <span>· {d.sourceFilename}</span>}
                    {d.tags && <span>· tags: {d.tags}</span>}
                    <span>· added {new Date(d.createdAt).toLocaleDateString()}</span>
                    {d.createdByName && <span>by {d.createdByName}</span>}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setDeletingId(d.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddKbDocumentDialog
          onClose={() => setShowAdd(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ["hr-kb-documents"] })}
        />
      )}

      <Dialog open={deletingId !== null} onOpenChange={v => !v && setDeletingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this document?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The AI will no longer reference it when drafting replies. This can't be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddKbDocumentDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [sourceFilename, setSourceFilename] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      setErr("File too large (max 2MB). Split the document or paste sections.");
      return;
    }
    const name = f.name.toLowerCase();
    if (!(name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".markdown") || name.endsWith(".csv"))) {
      setErr("Only .txt, .md or .csv files can be auto-imported. For PDF/DOCX, copy the text and paste it below.");
      return;
    }
    try {
      const text = await f.text();
      setContent(text);
      setSourceFilename(f.name);
      if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || "Could not read file");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!title.trim() || !content.trim()) {
      setErr("Title and content are required.");
      return;
    }
    if (content.length < 20) {
      setErr("Content is too short (min 20 characters).");
      return;
    }
    setSaving(true);
    try {
      await apiFetchJson("/api/hr-kb-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content,
          tags: tags.trim() || null,
          sourceFilename,
        }),
      });
      toast({ title: "Added to knowledge base" });
      onCreated();
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Knowledge Base Document
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="flex-1 overflow-y-auto space-y-4 pr-1">
          {err && (
            <div className="bg-destructive/10 border-l-4 border-destructive text-destructive p-3 rounded-r-lg flex gap-2 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Annual Leave Policy 2026"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tags (optional)</Label>
            <Input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="comma-separated, e.g. leave, policy, 2026"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Content *</Label>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.md,.markdown,.csv,text/plain,text/markdown"
                  onChange={handleFile}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="w-3.5 h-3.5" /> Import .txt / .md
                </Button>
              </div>
            </div>
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Paste the policy text, FAQ entries, or handbook section…"
              className="min-h-[260px] font-mono text-xs"
              required
            />
            <div className="text-xs text-muted-foreground flex items-center justify-between">
              <span>{content.length.toLocaleString()} characters</span>
              {sourceFilename && <span>Source: {sourceFilename}</span>}
            </div>
            <p className="text-xs text-muted-foreground">
              For PDFs or Word documents, copy the text and paste it here. The AI references this content when drafting replies.
            </p>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="gap-1.5">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Plus className="w-4 h-4" /> Add Document</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
