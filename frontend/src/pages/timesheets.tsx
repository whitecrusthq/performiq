import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardCheck, Send, CheckCircle2, XCircle, Clock,
  ChevronLeft, ChevronRight, CalendarDays, Plus, Trash2, GripVertical,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiFetch as apiFetchBase } from "@/lib/utils";

async function apiFetch(url: string, opts: RequestInit = {}) {
  const r = await apiFetchBase(url, opts);
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error ?? "Request failed");
  }
  return r.json();
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_WEEKS_BACK = 13;

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft:     "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    approved:  "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    rejected:  "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  };
  return <Badge className={map[status] ?? ""}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
}

function fmtHours(mins: number) {
  if (!mins) return "0h";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric" });
}

function fmtDateFull(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toISO(d: Date) { return d.toISOString().split("T")[0]; }

function getWeekDates(weekStart: string): string[] {
  const start = new Date(weekStart + "T00:00:00");
  return Array.from({ length: 7 }, (_, i) => toISO(addDays(start, i)));
}

function getMonthLabel(weekStart: string) {
  return new Date(weekStart + "T00:00:00").toLocaleDateString([], { month: "long", year: "numeric" });
}

// ── Approval chain display component ─────────────────────────────────────────
function ApprovalChain({ approvers, currentApproverId }: { approvers: any[]; currentApproverId: number | null }) {
  if (!approvers || approvers.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground font-medium">Approval chain:</span>
      {approvers.map((step, i) => {
        const isDone = step.status === "approved";
        const isRejected = step.status === "rejected";
        const isActive = step.status === "pending" && step.approverId === currentApproverId;
        return (
          <span key={step.id} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border
              ${isDone     ? "bg-green-100 text-green-700 border-green-200" :
                isRejected ? "bg-red-100 text-red-700 border-red-200" :
                isActive   ? "bg-blue-100 text-blue-700 border-blue-300 ring-1 ring-blue-300" :
                             "bg-muted text-muted-foreground border-border"}`}>
              <span className="opacity-60 font-normal">{i + 1}.</span>
              {step.approver?.name ?? `Approver ${i + 1}`}
              {step.approver?.department && (
                <span className="opacity-60 font-normal"> · {step.approver.department}</span>
              )}
              {isDone     && <CheckCircle2 className="w-3 h-3" />}
              {isRejected && <XCircle className="w-3 h-3" />}
              {isActive   && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
            </span>
          </span>
        );
      })}
    </div>
  );
}

// ── Submit dialog with approver picker ───────────────────────────────────────
function SubmitDialog({
  open, onClose, onSubmit, submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (approverIds: number[]) => void;
  submitting: boolean;
}) {
  const { data: availableApprovers = [] } = useQuery<any[]>({
    queryKey: ["ts-approvers"],
    queryFn: () => apiFetch("/api/timesheets/approvers"),
    enabled: open,
  });

  const [selected, setSelected] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const filtered = (availableApprovers as any[]).filter(a =>
    !selected.some(s => s.id === a.id) &&
    (a.name?.toLowerCase().includes(search.toLowerCase()) ||
     a.email?.toLowerCase().includes(search.toLowerCase()) ||
     a.department?.toLowerCase().includes(search.toLowerCase()))
  );

  const addApprover = (a: any) => { setSelected(prev => [...prev, a]); setSearch(""); };
  const removeApprover = (id: number) => setSelected(prev => prev.filter(a => a.id !== id));
  const moveUp = (i: number) => {
    if (i === 0) return;
    setSelected(prev => { const n = [...prev]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; });
  };
  const moveDown = (i: number) => {
    setSelected(prev => {
      if (i >= prev.length - 1) return prev;
      const n = [...prev]; [n[i], n[i + 1]] = [n[i + 1], n[i]]; return n;
    });
  };

  const handleSubmit = () => onSubmit(selected.map(a => a.id));

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit Timesheet for Approval</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Select managers who need to approve your timesheet in order. HR/admin will be the final approver.
          </p>
        </DialogHeader>

        {/* Ordered approver list */}
        {selected.length > 0 && (
          <div className="space-y-2 mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Approval Order</p>
            {selected.map((a, i) => (
              <div key={a.id} className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2">
                <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">{a.name ?? a.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {[a.role?.replace("_", " "), a.department].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => moveUp(i)} disabled={i === 0} className="p-1 rounded hover:bg-muted disabled:opacity-30">
                    <ChevronLeft className="w-3.5 h-3.5 rotate-90" />
                  </button>
                  <button onClick={() => moveDown(i)} disabled={i === selected.length - 1} className="p-1 rounded hover:bg-muted disabled:opacity-30">
                    <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                  </button>
                  <button onClick={() => removeApprover(a.id)} className="p-1 rounded hover:bg-destructive/10 text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Approver search */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Add Approver</p>
          <Input
            placeholder="Search by name, email or department…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="mb-2"
          />
          <div className="max-h-48 overflow-y-auto rounded-xl border border-border divide-y divide-border">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {search ? "No matches found" : "All available approvers added"}
              </p>
            ) : filtered.map((a: any) => (
              <button
                key={a.id}
                onClick={() => addApprover(a)}
                className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors flex items-center gap-3"
              >
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                  {(a.name ?? a.email ?? "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{a.name ?? a.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {[a.role?.replace("_", " "), a.department].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Plus className="w-4 h-4 text-primary shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {selected.length === 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            ⚠ No approvers selected — it will go directly to your direct manager (if assigned) or HR.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
            <Send className="w-4 h-4" />
            {submitting ? "Submitting…" : "Submit for Approval"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Timesheets() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isManager = user?.role === "manager" || user?.role === "admin" || user?.role === "super_admin";

  const [weekOffset, setWeekOffset] = useState(0);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const selectedDate = useMemo(() => toISO(addDays(new Date(), weekOffset * 7)), [weekOffset]);

  const { weekStart, weekEnd, isCurrentWeek } = useMemo(() => {
    const monday = getMonday(new Date(selectedDate + "T00:00:00"));
    const sunday = addDays(monday, 6);
    const currentMonday = getMonday(new Date());
    return {
      weekStart: toISO(monday), weekEnd: toISO(sunday),
      isCurrentWeek: toISO(monday) === toISO(currentMonday),
    };
  }, [selectedDate]);

  const canGoBack = weekOffset > -MAX_WEEKS_BACK;
  const canGoForward = weekOffset < 0;

  const { data: current, isLoading: currentLoading } = useQuery({
    queryKey: ["timesheets-week", selectedDate],
    queryFn: () => apiFetch(`/api/timesheets/week?date=${selectedDate}`),
  });

  const { data: all = [], isLoading: allLoading } = useQuery({
    queryKey: ["timesheets-all"],
    queryFn: () => apiFetch("/api/timesheets"),
  });

  const updateEntry = useMutation({
    mutationFn: ({ date, minutes }: { date: string; minutes: number }) =>
      apiFetch(`/api/timesheets/${current?.id}/entries`, {
        method: "PUT",
        body: JSON.stringify({ date, minutes }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timesheets-week", selectedDate] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const submit = useMutation({
    mutationFn: (approverIds: number[]) =>
      apiFetch(`/api/timesheets/${current?.id}/submit`, {
        method: "POST",
        body: JSON.stringify({ approverIds }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timesheets-week", selectedDate] });
      qc.invalidateQueries({ queryKey: ["timesheets-all"] });
      setSubmitOpen(false);
      toast({ title: "Timesheet submitted", description: "Your approvers will be notified." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const approve = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/timesheets/${id}/approve`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timesheets-all"] });
      qc.invalidateQueries({ queryKey: ["timesheets-week", selectedDate] });
      toast({ title: "Approved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reject = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      apiFetch(`/api/timesheets/${id}/reject`, { method: "POST", body: JSON.stringify({ notes }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timesheets-all"] });
      qc.invalidateQueries({ queryKey: ["timesheets-week", selectedDate] });
      setRejectOpen(false);
      setRejectNote("");
      toast({ title: "Timesheet rejected" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const weekDates = weekStart ? getWeekDates(weekStart) : [];
  const entryMap: Record<string, number> = {};
  if (current?.entries) {
    for (const e of current.entries) entryMap[e.date] = e.minutes ?? 0;
  }

  const canEdit = current?.status === "draft" || current?.status === "rejected";

  const totalRegular = weekDates.slice(0, 5).reduce((s, d) => s + (entryMap[d] ?? 0), 0);
  const totalWeekend = weekDates.slice(5).reduce((s, d) => s + (entryMap[d] ?? 0), 0);
  const totalOT = weekDates.reduce((s, d, i) => {
    const mins = entryMap[d] ?? 0;
    return s + (i >= 5 ? mins : Math.max(0, mins - 480));
  }, 0);

  // Pending for manager: submitted timesheets where I am the current approver
  const pendingTeam = isManager
    ? (all as any[]).filter((t: any) => {
        if (t.status !== "submitted" || t.userId === user?.id) return false;
        // Show if I'm the next pending approver, or admin/super_admin
        if (user?.role === "admin" || user?.role === "super_admin") return true;
        return t.currentApproverId === user?.id;
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Timesheets</h1>
        <p className="text-muted-foreground text-sm mt-1">Log your weekly hours and submit for approval</p>
      </div>

      {/* Week Navigator */}
      <div className="flex items-center justify-between gap-4 bg-card border border-border rounded-2xl px-5 py-3">
        <button
          onClick={() => setWeekOffset(w => w - 1)}
          disabled={!canGoBack}
          className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">{fmtDate(weekStart)} – {fmtDate(weekEnd)}</span>
            {isCurrentWeek && (
              <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">Current Week</span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{getMonthLabel(weekStart)}</span>
        </div>

        <div className="flex items-center gap-2">
          {!isCurrentWeek && (
            <button onClick={() => setWeekOffset(0)} className="text-xs text-primary hover:underline font-medium">Today</button>
          )}
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            disabled={!canGoForward}
            className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Timesheet Grid */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-semibold text-sm">{isCurrentWeek ? "This Week" : `Week of ${fmtDate(weekStart)}`}</p>
              <p className="text-xs text-muted-foreground">{fmtDateFull(weekStart)} – {fmtDateFull(weekEnd)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {current && <StatusBadge status={current.status} />}
            <span className="text-sm font-medium text-muted-foreground">{fmtHours(current?.totalMinutes ?? 0)} total</span>
          </div>
        </div>

        {currentLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : (
          <>
            <div className="p-4 grid grid-cols-7 gap-2">
              {weekDates.map((date, i) => {
                const mins = entryMap[date] ?? 0;
                const hours = Math.floor(mins / 60);
                const isWeekend = i >= 5;
                const otMins = isWeekend ? mins : Math.max(0, mins - 480);
                const today = toISO(new Date());
                return (
                  <div key={date} className={`flex flex-col items-center gap-1 ${isWeekend ? "opacity-80" : ""}`}>
                    <span className={`text-xs font-semibold ${isWeekend ? "text-amber-500" : "text-muted-foreground"}`}>{DAYS[i]}</span>
                    <span className={`text-xs text-muted-foreground mb-1 ${date === today ? "text-primary font-semibold" : ""}`}>{fmtDate(date)}</span>
                    {canEdit ? (
                      <div className="flex flex-col items-center gap-1 w-full">
                        <Input
                          type="number" min="0" max="24" placeholder="0"
                          className={`w-full text-center h-10 text-sm font-semibold ${isWeekend ? "border-amber-200 dark:border-amber-900/50" : ""}`}
                          defaultValue={hours || ""}
                          key={`${date}-${hours}`}
                          onBlur={e => {
                            const h = parseFloat(e.target.value) || 0;
                            const newMins = Math.round(h * 60);
                            if (newMins !== mins) updateEntry.mutate({ date, minutes: newMins });
                          }}
                        />
                        <span className="text-xs text-muted-foreground">hrs</span>
                        {otMins > 0 && <span className="text-xs font-medium text-amber-600 dark:text-amber-400">+{fmtHours(otMins)} OT</span>}
                        {isWeekend && mins > 0 && !otMins && <span className="text-xs font-medium text-amber-600">OT</span>}
                      </div>
                    ) : (
                      <div className={`w-full rounded-lg border p-2 text-center ${mins > 0
                        ? (isWeekend || otMins > 0 ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700" : "bg-primary/10 border-primary/20")
                        : "border-border bg-muted/30"}`}>
                        <span className="text-sm font-semibold">{mins > 0 ? `${hours}h` : "—"}</span>
                        {(isWeekend && mins > 0) && <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">OT</div>}
                        {(!isWeekend && otMins > 0) && <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">+{fmtHours(otMins)}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {(current?.totalMinutes ?? 0) > 0 && (
              <div className="px-4 pb-2 flex flex-wrap gap-4 text-xs text-muted-foreground border-t border-border pt-3 mx-4">
                <span>Regular: <span className="font-semibold text-foreground">{fmtHours(totalRegular)}</span></span>
                {totalWeekend > 0 && <span>Weekend OT: <span className="font-semibold text-amber-600 dark:text-amber-400">{fmtHours(totalWeekend)}</span></span>}
                {totalOT > 0 && <span>Overtime: <span className="font-semibold text-amber-600 dark:text-amber-400">{fmtHours(totalOT)}</span></span>}
                <span>Total: <span className="font-semibold text-foreground">{fmtHours(current?.totalMinutes ?? 0)}</span></span>
              </div>
            )}

            {/* Approval chain for this sheet */}
            {current?.approvers?.length > 0 && (
              <div className="px-6 pb-3">
                <ApprovalChain approvers={current.approvers} currentApproverId={current.currentApproverId} />
              </div>
            )}
          </>
        )}

        <div className="px-6 pb-5 pt-2">
          {canEdit && (
            <Button
              className="gap-2"
              onClick={() => setSubmitOpen(true)}
              disabled={!current?.totalMinutes}
            >
              <Send className="w-4 h-4" /> Submit for Approval
            </Button>
          )}
          {current?.status === "submitted" && (
            <p className="text-sm text-muted-foreground italic flex items-center gap-2">
              <Clock className="w-4 h-4" /> Submitted — awaiting approval
            </p>
          )}
          {current?.status === "approved" && (
            <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Approved
            </p>
          )}
          {current?.status === "rejected" && (
            <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Rejected{current.notes ? ` — ${current.notes}` : ""}. Please update and resubmit.
            </p>
          )}
        </div>
      </div>

      {/* Manager: Pending approvals */}
      {isManager && pendingTeam.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Pending Your Approval</h2>
          <div className="rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Employee</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Week</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Total</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Chain</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pendingTeam.map((t: any) => (
                  <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{t.user?.name ?? t.user?.email ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(t.weekStart)} – {fmtDate(t.weekEnd)}</td>
                    <td className="px-4 py-3">{fmtHours(t.totalMinutes)}</td>
                    <td className="px-4 py-3">
                      <ApprovalChain approvers={t.approvers ?? []} currentApproverId={t.currentApproverId} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline"
                          className="gap-1 text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20"
                          onClick={() => approve.mutate(t.id)} disabled={approve.isPending}>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </Button>
                        <Button size="sm" variant="outline"
                          className="gap-1 text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => { setRejectId(t.id); setRejectOpen(true); }}>
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">{isManager ? "All Timesheets" : "History"}</h2>
        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-muted/50">
              <tr>
                {isManager && <th className="text-left px-4 py-3 font-medium text-muted-foreground">Employee</th>}
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Week</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Total</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Approval</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allLoading ? (
                <tr><td colSpan={isManager ? 5 : 4} className="text-center py-8 text-muted-foreground">Loading…</td></tr>
              ) : (all as any[]).length === 0 ? (
                <tr><td colSpan={isManager ? 5 : 4} className="text-center py-8 text-muted-foreground">No timesheets yet</td></tr>
              ) : (all as any[]).map((t: any) => (
                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                  {isManager && <td className="px-4 py-3">{t.user?.name ?? t.user?.email ?? "—"}</td>}
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(t.weekStart)} – {fmtDate(t.weekEnd)}</td>
                  <td className="px-4 py-3 font-medium">{fmtHours(t.totalMinutes)}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3">
                    {t.approvers?.length > 0
                      ? <ApprovalChain approvers={t.approvers} currentApproverId={t.currentApproverId} />
                      : <span className="text-xs text-muted-foreground">—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Submit Dialog */}
      <SubmitDialog
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        onSubmit={ids => submit.mutate(ids)}
        submitting={submit.isPending}
      />

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Timesheet</DialogTitle></DialogHeader>
          <Textarea
            placeholder="Reason for rejection (optional)"
            value={rejectNote}
            onChange={e => setRejectNote(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => rejectId && reject.mutate({ id: rejectId, notes: rejectNote })}
              disabled={reject.isPending}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
