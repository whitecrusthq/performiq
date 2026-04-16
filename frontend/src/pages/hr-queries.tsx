import { useState, useEffect, useRef } from "react";
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
import { BulkActionBar } from "@/components/bulk-action-bar";

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
            {isEdit ? "Save Changes" : "Submit Ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Query Detail Sheet ────────────────────────────────────────────────────────
function QueryDetailSheet({
  query, isHR, currentUser, onClose, onUpdate, onDelete,
}: {
  query: any;
  isHR: boolean;
  currentUser: any;
  onClose: () => void;
  onUpdate: (id: number, data: any) => void;
  onDelete: (id: number) => void;
}) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<any[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(true);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [newStatus, setNewStatus] = useState(query.status);
  const [newPriority, setNewPriority] = useState(query.priority);
  const [editOpen, setEditOpen] = useState(false);
  const [liveQuery, setLiveQuery] = useState(query);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isClosed = liveQuery.status === "closed";
  const canEdit = !isHR && liveQuery.status === "open";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMsgsLoading(true);
      try {
        const res = await apiFetchBase(`/api/hr-queries/${query.id}/messages`);
        if (!cancelled && res.ok) setMessages(await res.json());
      } finally {
        if (!cancelled) setMsgsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [query.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const body = msgText.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await apiFetchBase(`/api/hr-queries/${query.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      const msg = await res.json();
      setMessages(prev => [...prev, msg]);
      setMsgText("");
      // If HR sent first reply, query moves to in_progress
      if (isHR && liveQuery.status === "open") {
        const updated = { ...liveQuery, status: "in_progress" };
        setLiveQuery(updated);
        setNewStatus("in_progress");
        onUpdate(query.id, { status: "in_progress" });
      }
    } catch (err: any) {
      toast({ title: err.message || "Failed to send", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const saveSettings = () => {
    onUpdate(query.id, { status: newStatus, priority: newPriority });
    setLiveQuery((p: any) => ({ ...p, status: newStatus, priority: newPriority }));
    toast({ title: "Query updated" });
  };

  return (
    <>
      <Sheet open onOpenChange={v => !v && onClose()}>
        <SheetContent className="w-full sm:max-w-xl flex flex-col p-0 gap-0">
          {/* Header */}
          <SheetHeader className="px-5 pt-5 pb-3 border-b shrink-0">
            <SheetTitle className="text-base leading-snug pr-6">{liveQuery.title}</SheetTitle>
            <div className="flex flex-wrap gap-2 mt-1">
              {statusBadge(liveQuery.status)}
              {priorityBadge(liveQuery.priority)}
              <Badge variant="outline" className="text-xs">{catLabel(liveQuery.category)}</Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {isHR && query.submitter && <span>From <strong>{query.submitter.name}</strong> · </span>}
              {fmtDate(query.createdAt)}
            </div>
          </SheetHeader>

          {/* HR controls (status / priority) */}
          {isHR && (
            <div className="px-5 py-3 border-b bg-muted/30 shrink-0 flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[110px]">
                <Label className="text-xs">Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.filter(s => s.value !== "all").map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[110px]">
                <Label className="text-xs">Priority</Label>
                <Select value={newPriority} onValueChange={setNewPriority}>
                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={saveSettings}>Save</Button>
                <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => { onDelete(query.id); onClose(); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Chat thread */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {/* Original query as first bubble */}
            <div className="flex flex-col items-start gap-1">
              <span className="text-[11px] text-muted-foreground px-1">
                {query.submitter?.name ?? "Employee"} · {fmtDate(query.createdAt)}
              </span>
              <div className="max-w-[85%] bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm whitespace-pre-wrap">
                {query.description}
              </div>
            </div>

            {/* Message thread */}
            {msgsLoading ? (
              <div className="text-center text-xs text-muted-foreground py-4">Loading messages…</div>
            ) : (
              messages.map(msg => {
                const isMine = msg.senderId === currentUser?.id;
                const isHRMsg = ["super_admin", "admin"].includes(msg.senderRole);
                return (
                  <div key={msg.id} className={`flex flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}>
                    <span className="text-[11px] text-muted-foreground px-1">
                      {msg.senderName}{isHRMsg ? " (HR)" : ""} · {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}, {fmtDate(msg.createdAt)}
                    </span>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                      isMine
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : isHRMsg
                          ? "bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-100 rounded-tl-sm"
                          : "bg-muted rounded-tl-sm"
                    }`}>
                      {msg.body}
                    </div>
                  </div>
                );
              })
            )}

            {isClosed && (
              <div className="text-center text-xs text-muted-foreground py-2 border-t">
                This query has been closed.
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Message input */}
          {!isClosed && (
            <div className="px-4 py-3 border-t bg-background shrink-0">
              {canEdit && (
                <div className="flex gap-2 mb-2">
                  <Button variant="outline" size="sm" className="text-xs gap-1.5 h-7" onClick={() => setEditOpen(true)}>
                    <Pencil className="w-3 h-3" /> Edit Query
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs gap-1.5 h-7 text-destructive hover:text-destructive" onClick={() => { onDelete(query.id); onClose(); }}>
                    <Trash2 className="w-3 h-3" /> Delete
                  </Button>
                </div>
              )}
              <div className="flex gap-2 items-end">
                <Textarea
                  className="flex-1 min-h-[44px] max-h-32 text-sm resize-none"
                  placeholder={isHR ? "Reply to employee…" : "Send a follow-up message to HR…"}
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  disabled={sending}
                />
                <Button size="icon" onClick={sendMessage} disabled={!msgText.trim() || sending} className="shrink-0 h-10 w-10">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Press Enter to send · Shift+Enter for new line</p>
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

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleSelect = (id: number) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleAll = (items: any[]) => {
    if (selectedIds.size === items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map((q: any) => q.id)));
  };

  const handleBulkDelete = async (items: any[]) => {
    if (!confirm(`Delete ${selectedIds.size} selected query/queries?`)) return;
    setBulkDeleting(true);
    await Promise.all([...selectedIds].map(id =>
      new Promise<void>(resolve => deleteMutation.mutate(id, { onSuccess: () => resolve(), onError: () => resolve() }))
    ));
    qc.invalidateQueries({ queryKey: ["hr-queries"] });
    setSelectedIds(new Set());
    setBulkDeleting(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="HR Support"
        description={isHR
          ? "Review and respond to queries raised by employees."
          : "Raise questions or issues directly to the HR department."}
      >
        <Button onClick={() => setSubmitOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Submit Ticket
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
                : "You haven't raised any queries yet. Click 'Submit Ticket' to get started."
              : "No queries match the current filters."}
          </p>
        </div>
      ) : (
        <>
          {isHR && <BulkActionBar count={selectedIds.size} onDelete={() => handleBulkDelete(filtered)} onClear={() => setSelectedIds(new Set())} deleting={bulkDeleting} />}
          <div className="space-y-2">
          {filtered.map((q: any) => (
            <div key={q.id} className="flex items-center gap-2">
              {isHR && (
                <input
                  type="checkbox"
                  checked={selectedIds.has(q.id)}
                  onChange={() => toggleSelect(q.id)}
                  onClick={e => e.stopPropagation()}
                  className="w-4 h-4 accent-primary cursor-pointer shrink-0"
                />
              )}
              <button
                onClick={() => setSelected(q)}
                className={`flex-1 text-left bg-card border rounded-xl px-4 py-3.5 hover:border-primary/40 hover:shadow-sm transition-all group ${selectedIds.has(q.id) ? "border-primary/40 bg-primary/5" : ""}`}
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
            </div>
          ))}
          </div>
        </>
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
          currentUser={user}
          onClose={() => setSelected(null)}
          onUpdate={(id, data) => updateMutation.mutate({ id, data })}
          onDelete={id => deleteMutation.mutate(id)}
        />
      )}
    </div>
  );
}
