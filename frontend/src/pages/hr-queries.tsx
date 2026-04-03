import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  MessageSquareWarning, Plus, Filter, ChevronRight, Clock, CheckCircle2,
  CircleDot, XCircle, AlertTriangle, User, Send, Trash2, Pencil, RotateCcw,
} from "lucide-react";

import { apiFetch as apiFetchBase } from "@/lib/utils";

// ── helpers ───────────────────────────────────────────────────────────────────
async function apiFetch(url: string, opts: RequestInit = {}) {
  const res = await apiFetchBase(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Request failed");
  }
  return res.json();
}

const CATEGORIES = [
  { value: "general",   label: "General" },
  { value: "payroll",   label: "Payroll" },
  { value: "benefits",  label: "Benefits" },
  { value: "policy",    label: "Policy" },
  { value: "leave",     label: "Leave" },
  { value: "contract",  label: "Contract" },
  { value: "conduct",   label: "Conduct" },
  { value: "other",     label: "Other" },
];

const STATUSES = [
  { value: "all",         label: "All" },
  { value: "open",        label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved",    label: "Resolved" },
  { value: "closed",      label: "Closed" },
];

const PRIORITIES = [
  { value: "low",    label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high",   label: "High" },
];

function statusBadge(status: string) {
  switch (status) {
    case "open":        return <Badge className="bg-blue-100 text-blue-700 border-blue-200"><CircleDot className="w-3 h-3 mr-1" />Open</Badge>;
    case "in_progress": return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><Clock className="w-3 h-3 mr-1" />In Progress</Badge>;
    case "resolved":    return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" />Resolved</Badge>;
    case "closed":      return <Badge className="bg-gray-100 text-gray-600 border-gray-200"><XCircle className="w-3 h-3 mr-1" />Closed</Badge>;
    default:            return <Badge variant="outline">{status}</Badge>;
  }
}

function priorityBadge(priority: string) {
  switch (priority) {
    case "high":   return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs"><AlertTriangle className="w-3 h-3 mr-1" />High</Badge>;
    case "normal": return <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-xs">Normal</Badge>;
    case "low":    return <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-xs">Low</Badge>;
    default:       return null;
  }
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function catLabel(cat: string) {
  return CATEGORIES.find(c => c.value === cat)?.label ?? cat;
}

// ── Submit / Edit Dialog ──────────────────────────────────────────────────────
function QueryFormDialog({
  open, onClose, initial, onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial?: any;
  onSave: (data: any) => void;
}) {
  const isEdit = !!initial;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "general");
  const [priority, setPriority] = useState(initial?.priority ?? "normal");

  const handleSave = () => {
    if (!title.trim() || !description.trim()) return;
    onSave({ title, description, category, priority });
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Query" : "Submit a Query to HR"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Subject / Title <span className="text-red-500">*</span></Label>
            <Input className="mt-1" placeholder="e.g. Query about my payslip for March" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Details <span className="text-red-500">*</span></Label>
            <Textarea
              className="mt-1 min-h-[120px]"
              placeholder="Describe your query in detail. The more context you provide, the faster HR can help."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!title.trim() || !description.trim()}>
            <Send className="w-4 h-4 mr-2" />
            {isEdit ? "Save Changes" : "Submit Query"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Query Detail Sheet ────────────────────────────────────────────────────────
function QueryDetailSheet({
  query, isHR, onClose, onUpdate, onDelete,
}: {
  query: any;
  isHR: boolean;
  onClose: () => void;
  onUpdate: (id: number, data: any) => void;
  onDelete: (id: number) => void;
}) {
  const [response, setResponse] = useState(query.response ?? "");
  const [newStatus, setNewStatus] = useState(query.status);
  const [newPriority, setNewPriority] = useState(query.priority);
  const [editOpen, setEditOpen] = useState(false);

  const canEdit = !isHR && query.status === "open";

  return (
    <>
      <Sheet open onOpenChange={v => !v && onClose()}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-base leading-snug pr-6">{query.title}</SheetTitle>
            <div className="flex flex-wrap gap-2 mt-1">
              {statusBadge(query.status)}
              {priorityBadge(query.priority)}
              <Badge variant="outline" className="text-xs">{catLabel(query.category)}</Badge>
            </div>
          </SheetHeader>

          {/* Meta */}
          <div className="text-xs text-muted-foreground space-y-1 mb-4">
            {isHR && query.submitter && (
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>Submitted by <strong>{query.submitter.name}</strong> ({query.submitter.email})</span>
              </div>
            )}
            <div>Submitted on {fmtDate(query.createdAt)}</div>
            {query.respondedAt && (
              <div>Responded on {fmtDate(query.respondedAt)}
                {query.responder ? ` by ${query.responder.name}` : ""}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Query Details</p>
            <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap">{query.description}</div>
          </div>

          {/* HR Response (view) */}
          {query.response && !isHR && (
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">HR Response</p>
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm whitespace-pre-wrap">{query.response}</div>
            </div>
          )}

          {/* HR Panel */}
          {isHR && (
            <div className="space-y-4 border-t pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">HR Actions</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.filter(s => s.value !== "all").map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Priority</Label>
                  <Select value={newPriority} onValueChange={setNewPriority}>
                    <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs">Response / Notes</Label>
                <Textarea
                  className="mt-1 min-h-[120px] text-sm"
                  placeholder="Write your response to the employee here..."
                  value={response}
                  onChange={e => setResponse(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => {
                    onUpdate(query.id, { status: newStatus, priority: newPriority, response: response || undefined });
                    onClose();
                  }}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Save & Respond
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  title="Delete query"
                  onClick={() => { onDelete(query.id); onClose(); }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Employee actions */}
          {!isHR && (
            <div className="border-t pt-4 flex gap-2">
              {canEdit && (
                <Button variant="outline" className="gap-2" onClick={() => setEditOpen(true)}>
                  <Pencil className="w-4 h-4" /> Edit Query
                </Button>
              )}
              {canEdit && (
                <Button variant="outline" className="gap-2 text-destructive hover:text-destructive" onClick={() => { onDelete(query.id); onClose(); }}>
                  <Trash2 className="w-4 h-4" /> Delete
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {editOpen && (
        <QueryFormDialog
          open
          onClose={() => setEditOpen(false)}
          initial={query}
          onSave={data => {
            onUpdate(query.id, data);
            setEditOpen(false);
            onClose();
          }}
        />
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HrQueries() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const isHR = ["super_admin", "admin"].includes((user as any)?.role ?? "") ||
    (user as any)?.customRole?.name?.toLowerCase() === "hr manager";

  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  // Fetch
  const { data: queries = [], isLoading } = useQuery({
    queryKey: ["hr-queries"],
    queryFn: () => apiFetch("/api/hr-queries"),
  });

  // Stats (HR only)
  const stats = {
    total: queries.length,
    open: queries.filter((q: any) => q.status === "open").length,
    inProgress: queries.filter((q: any) => q.status === "in_progress").length,
    resolved: queries.filter((q: any) => q.status === "resolved").length,
  };

  // Filter
  const filtered = queries.filter((q: any) => {
    if (statusFilter !== "all" && q.status !== statusFilter) return false;
    if (categoryFilter !== "all" && q.category !== categoryFilter) return false;
    if (priorityFilter !== "all" && q.priority !== priorityFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!q.title.toLowerCase().includes(s) &&
          !q.description.toLowerCase().includes(s) &&
          !(q.submitter?.name?.toLowerCase().includes(s))) return false;
    }
    return true;
  });

  // Create
  const createMutation = useMutation({
    mutationFn: (data: any) => apiFetch("/api/hr-queries", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-queries"] });
      setSubmitOpen(false);
      toast({ title: "Query submitted", description: "HR will review and respond to your query." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Update
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiFetch(`/api/hr-queries/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-queries"] });
      toast({ title: "Query updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/hr-queries/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-queries"] });
      toast({ title: "Query deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="HR Queries"
        description={isHR
          ? "Review and respond to queries raised by employees."
          : "Raise questions or issues directly to the HR department."}
      >
        <Button onClick={() => setSubmitOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Submit Query
        </Button>
      </PageHeader>

      {/* Stats (HR only) */}
      {isHR && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total, color: "text-foreground" },
            { label: "Open", value: stats.open, color: "text-blue-600" },
            { label: "In Progress", value: stats.inProgress, color: "text-amber-600" },
            { label: "Resolved", value: stats.resolved, color: "text-green-600" },
          ].map(s => (
            <div key={s.label} className="bg-card border rounded-xl p-4 text-center shadow-sm">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Status tabs */}
        <div className="flex gap-1 bg-muted p-1 rounded-lg flex-wrap">
          {STATUSES.map(s => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                statusFilter === s.value
                  ? "bg-background text-foreground shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
              {s.value !== "all" && (
                <span className="ml-1.5 text-[10px] opacity-60">
                  {queries.filter((q: any) => q.status === s.value).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Category */}
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-8 w-36 text-xs gap-1">
            <Filter className="w-3 h-3" /><SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Priority */}
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Search */}
        {isHR && (
          <Input
            placeholder="Search queries…"
            className="h-8 text-xs w-48"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        )}

        {/* Reset */}
        {(statusFilter !== "all" || categoryFilter !== "all" || priorityFilter !== "all" || search) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground gap-1"
            onClick={() => { setStatusFilter("all"); setCategoryFilter("all"); setPriorityFilter("all"); setSearch(""); }}
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </Button>
        )}
      </div>

      {/* Query List */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-16 text-sm">Loading queries…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <MessageSquareWarning className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {queries.length === 0
              ? isHR
                ? "No queries have been submitted yet."
                : "You haven't raised any queries yet. Click 'Submit Query' to get started."
              : "No queries match the current filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((q: any) => (
            <button
              key={q.id}
              onClick={() => setSelected(q)}
              className="w-full text-left bg-card border rounded-xl px-4 py-3.5 hover:border-primary/40 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">{q.title}</span>
                    {statusBadge(q.status)}
                    {priorityBadge(q.priority)}
                    <Badge variant="outline" className="text-xs">{catLabel(q.category)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{q.description}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                    {isHR && q.submitter && (
                      <span className="flex items-center gap-1"><User className="w-3 h-3" />{q.submitter.name}</span>
                    )}
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate(q.createdAt)}</span>
                    {q.response && (
                      <span className="flex items-center gap-1 text-green-600 font-medium">
                        <CheckCircle2 className="w-3 h-3" />Response available
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground mt-1 shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Submit Dialog */}
      {submitOpen && (
        <QueryFormDialog
          open
          onClose={() => setSubmitOpen(false)}
          onSave={data => createMutation.mutate(data)}
        />
      )}

      {/* Detail Sheet */}
      {selected && (
        <QueryDetailSheet
          query={selected}
          isHR={isHR}
          onClose={() => setSelected(null)}
          onUpdate={(id, data) => updateMutation.mutate({ id, data })}
          onDelete={id => deleteMutation.mutate(id)}
        />
      )}
    </div>
  );
}
