import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ClipboardCheck, Send, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

async function apiFetch(url: string, opts: RequestInit = {}) {
  const r = await fetch(url, { ...opts, headers: { ...authHeader(), ...(opts.headers ?? {}) } });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error ?? "Request failed");
  }
  return r.json();
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    approved: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
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

function getWeekDates(weekStart: string) {
  const dates: string[] = [];
  const start = new Date(weekStart + "T00:00:00");
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

export default function Timesheets() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isManager = user?.role === "manager" || user?.role === "admin" || user?.role === "super_admin";

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const { data: current, isLoading: currentLoading } = useQuery({
    queryKey: ["timesheets-current"],
    queryFn: () => apiFetch("/api/timesheets/current"),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timesheets-current"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const submit = useMutation({
    mutationFn: () => apiFetch(`/api/timesheets/${current?.id}/submit`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timesheets-current"] });
      qc.invalidateQueries({ queryKey: ["timesheets-all"] });
      toast({ title: "Timesheet submitted", description: "Your manager will review it soon." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const approve = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/timesheets/${id}/approve`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timesheets-all"] });
      toast({ title: "Timesheet approved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reject = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      apiFetch(`/api/timesheets/${id}/reject`, { method: "POST", body: JSON.stringify({ notes }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timesheets-all"] });
      qc.invalidateQueries({ queryKey: ["timesheets-current"] });
      setRejectOpen(false);
      setRejectNote("");
      toast({ title: "Timesheet rejected" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const weekDates = current ? getWeekDates(current.weekStart) : [];
  const entryMap: Record<string, number> = {};
  if (current?.entries) {
    for (const e of current.entries) entryMap[e.date] = e.minutes ?? 0;
  }

  const canEdit = current?.status === "draft" || current?.status === "rejected";
  const pendingTeam = isManager
    ? (all as any[]).filter((t: any) => t.status === "submitted" && t.userId !== user?.id)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Timesheets</h1>
        <p className="text-muted-foreground text-sm mt-1">Log your weekly hours and submit for approval</p>
      </div>

      {/* Current Week */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-semibold text-sm">This Week</p>
              {current && (
                <p className="text-xs text-muted-foreground">{fmtDate(current.weekStart)} – {fmtDate(current.weekEnd)}</p>
              )}
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
          <div className="p-4 grid grid-cols-7 gap-2">
            {weekDates.map((date, i) => {
              const mins = entryMap[date] ?? 0;
              const hours = Math.floor(mins / 60);
              return (
                <div key={date} className="flex flex-col items-center gap-1">
                  <span className="text-xs font-medium text-muted-foreground">{DAYS[i]}</span>
                  <span className="text-xs text-muted-foreground mb-1">{fmtDate(date)}</span>
                  {canEdit ? (
                    <div className="flex flex-col items-center gap-1 w-full">
                      <Input
                        type="number" min="0" max="24" placeholder="0"
                        className="w-full text-center h-10 text-sm font-semibold"
                        defaultValue={hours || ""}
                        onBlur={e => {
                          const h = parseInt(e.target.value) || 0;
                          if (h !== hours) updateEntry.mutate({ date, minutes: h * 60 });
                        }}
                      />
                      <span className="text-xs text-muted-foreground">hrs</span>
                    </div>
                  ) : (
                    <div className={`w-full rounded-lg border p-2 text-center ${mins > 0 ? "bg-primary/10 border-primary/20" : "border-border bg-muted/30"}`}>
                      <span className="text-sm font-semibold">{mins > 0 ? `${hours}h` : "—"}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="px-6 pb-5 pt-2">
          {canEdit && (
            <Button
              className="gap-2"
              onClick={() => submit.mutate()}
              disabled={submit.isPending || !current?.totalMinutes}
            >
              <Send className="w-4 h-4" /> Submit for Approval
            </Button>
          )}
          {current?.status === "submitted" && (
            <p className="text-sm text-muted-foreground italic flex items-center gap-2">
              <Clock className="w-4 h-4" /> Submitted — awaiting manager approval
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
          <h2 className="text-base font-semibold">Pending Team Approvals</h2>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Employee</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Week</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Total</th>
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
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="gap-1 text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20"
                          onClick={() => approve.mutate(t.id)} disabled={approve.isPending}>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
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
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {isManager && <th className="text-left px-4 py-3 font-medium text-muted-foreground">Employee</th>}
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Week</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Total</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allLoading ? (
                <tr><td colSpan={isManager ? 4 : 3} className="text-center py-8 text-muted-foreground">Loading…</td></tr>
              ) : (all as any[]).length === 0 ? (
                <tr><td colSpan={isManager ? 4 : 3} className="text-center py-8 text-muted-foreground">No timesheets yet</td></tr>
              ) : (all as any[]).map((t: any) => (
                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                  {isManager && <td className="px-4 py-3">{t.user?.name ?? t.user?.email ?? "—"}</td>}
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(t.weekStart)} – {fmtDate(t.weekEnd)}</td>
                  <td className="px-4 py-3 font-medium">{fmtHours(t.totalMinutes)}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
