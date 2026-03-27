import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, Card, Button, Input, Label } from "@/components/shared";
import { CalendarDays, Plus, X, CheckCircle2, XCircle, Clock, Ban, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" });

const LEAVE_TYPES = ["annual", "sick", "personal", "maternity", "paternity", "unpaid", "other"] as const;
type LeaveType = typeof LEAVE_TYPES[number];
type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

const LEAVE_LABEL: Record<LeaveType, string> = {
  annual: "Annual Leave", sick: "Sick Leave", personal: "Personal Leave",
  maternity: "Maternity Leave", paternity: "Paternity Leave", unpaid: "Unpaid Leave", other: "Other",
};

const STATUS_CONFIG: Record<LeaveStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending:   { label: "Pending",   color: "bg-amber-100 text-amber-700",   icon: <Clock className="w-3.5 h-3.5" /> },
  approved:  { label: "Approved",  color: "bg-green-100 text-green-700",   icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  rejected:  { label: "Rejected",  color: "bg-red-100 text-red-700",       icon: <XCircle className="w-3.5 h-3.5" /> },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-500",     icon: <Ban className="w-3.5 h-3.5" /> },
};

function StatusBadge({ status }: { status: LeaveStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function calcDays(start: string, end: string) {
  if (!start || !end) return 0;
  const s = new Date(start), e = new Date(end);
  if (e < s) return 0;
  return Math.ceil((e.getTime() - s.getTime()) / 86400000) + 1;
}

function fmt(d: string) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

interface LeaveRequest {
  id: number; leaveType: LeaveType; startDate: string; endDate: string;
  days: number; reason?: string | null; status: LeaveStatus;
  reviewNote?: string | null; createdAt: string;
  employee?: { id: number; name: string; department?: string | null } | null;
  reviewer?: { id: number; name: string } | null;
}

export default function Leave() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reviewDialog, setReviewDialog] = useState<{ request: LeaveRequest; action: "approved" | "rejected" } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ leaveType: "annual" as LeaveType, startDate: "", endDate: "", reason: "" });

  const isManager = user && ["super_admin", "admin", "manager"].includes(user.role);

  const load = async () => {
    setIsLoading(true);
    try {
      const r = await fetch("/api/leave-requests", { headers: authHeader() });
      const data = await r.json();
      if (Array.isArray(data)) setRequests(data);
    } catch {}
    setIsLoading(false);
  };

  useEffect(() => { load(); }, []);

  const days = calcDays(form.startDate, form.endDate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMutationError(null);
    if (days <= 0) { setMutationError("End date must be on or after start date."); return; }
    setSubmitting(true);
    try {
      const r = await fetch("/api/leave-requests", {
        method: "POST", headers: authHeader(),
        body: JSON.stringify({ ...form, days }),
      });
      const data = await r.json();
      if (!r.ok) { setMutationError(data.error || "Failed to submit"); setSubmitting(false); return; }
      setIsDialogOpen(false);
      setForm({ leaveType: "annual", startDate: "", endDate: "", reason: "" });
      load();
    } catch { setMutationError("Network error"); }
    setSubmitting(false);
  };

  const handleCancel = async (id: number) => {
    await fetch(`/api/leave-requests/${id}`, { method: "PUT", headers: authHeader(), body: JSON.stringify({ status: "cancelled" }) });
    load();
  };

  const handleReview = async () => {
    if (!reviewDialog) return;
    setSubmitting(true);
    await fetch(`/api/leave-requests/${reviewDialog.request.id}`, {
      method: "PUT", headers: authHeader(),
      body: JSON.stringify({ status: reviewDialog.action, reviewNote }),
    });
    setReviewDialog(null);
    setReviewNote("");
    setSubmitting(false);
    load();
  };

  const filtered = filterStatus === "all" ? requests : requests.filter(r => r.status === filterStatus);

  return (
    <div>
      <PageHeader title="Leave Requests" description="Apply for leave and track approval status.">
        <Button onClick={() => { setMutationError(null); setForm({ leaveType: "annual", startDate: "", endDate: "", reason: "" }); setIsDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Apply for Leave
        </Button>
      </PageHeader>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-6">
        {["all", "pending", "approved", "rejected", "cancelled"].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filterStatus === s ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
          >
            {s === "all" ? "All" : STATUS_CONFIG[s as LeaveStatus]?.label ?? s}
            {" "}
            <span className="opacity-70">
              ({s === "all" ? requests.length : requests.filter(r => r.status === s).length})
            </span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 flex flex-col items-center gap-3 text-center">
          <CalendarDays className="w-10 h-10 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">No leave requests found</p>
          <p className="text-sm text-muted-foreground">Click "Apply for Leave" to submit your first request.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => (
            <Card key={req.id} className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-foreground">{LEAVE_LABEL[req.leaveType] ?? req.leaveType}</span>
                    <StatusBadge status={req.status} />
                  </div>
                  {isManager && req.employee && (
                    <p className="text-sm text-muted-foreground mb-1">
                      <span className="font-medium text-foreground">{req.employee.name}</span>
                      {req.employee.department && <span> · {req.employee.department}</span>}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {fmt(req.startDate)} – {fmt(req.endDate)} &nbsp;·&nbsp; <span className="font-medium">{req.days} day{req.days !== 1 ? "s" : ""}</span>
                  </p>
                  {req.reason && <p className="text-sm text-muted-foreground mt-1">Reason: {req.reason}</p>}
                  {req.reviewNote && (
                    <p className="text-sm mt-1">
                      <span className="font-medium">{req.reviewer?.name ?? "Reviewer"}:</span> {req.reviewNote}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">Submitted {fmt(req.createdAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {/* Employee can cancel their own pending request */}
                  {req.status === "pending" && req.employee?.id === user?.id && (
                    <Button variant="outline" size="sm" onClick={() => handleCancel(req.id)}>Cancel</Button>
                  )}
                  {/* Managers can approve/reject pending */}
                  {isManager && req.status === "pending" && (
                    <>
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => { setReviewNote(""); setReviewDialog({ request: req, action: "approved" }); }}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => { setReviewNote(""); setReviewDialog({ request: req, action: "rejected" }); }}>
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Apply for Leave Modal */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-xl font-bold">Apply for Leave</h2>
              <button onClick={() => setIsDialogOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              {mutationError && (
                <div className="bg-destructive/10 text-destructive border-l-4 border-destructive rounded-r-xl p-3 text-sm">{mutationError}</div>
              )}
              <div>
                <Label>Leave Type</Label>
                <select
                  className="w-full px-4 py-2 border rounded-xl bg-background text-sm"
                  value={form.leaveType}
                  onChange={e => setForm({ ...form, leaveType: e.target.value as LeaveType })}
                  required
                >
                  {LEAVE_TYPES.map(t => <option key={t} value={t}>{LEAVE_LABEL[t]}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start Date</Label>
                  <Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} required />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input type="date" value={form.endDate} min={form.startDate} onChange={e => setForm({ ...form, endDate: e.target.value })} required />
                </div>
              </div>
              {form.startDate && form.endDate && days > 0 && (
                <p className="text-sm text-primary font-medium">{days} working day{days !== 1 ? "s" : ""} selected</p>
              )}
              <div>
                <Label>Reason <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
                <textarea
                  className="w-full px-4 py-2 border rounded-xl bg-background text-sm resize-none"
                  rows={3}
                  placeholder="Briefly describe the reason for your leave..."
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="flex-1" isLoading={submitting}>Submit Request</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                {reviewDialog.action === "approved" ? "Approve" : "Reject"} Request
              </h2>
              <button onClick={() => setReviewDialog(null)}><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {reviewDialog.request.employee?.name} · {LEAVE_LABEL[reviewDialog.request.leaveType]} ·{" "}
              {fmt(reviewDialog.request.startDate)} – {fmt(reviewDialog.request.endDate)} ({reviewDialog.request.days} days)
            </p>
            <div className="mb-4">
              <Label>Note <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
              <textarea
                className="w-full px-4 py-2 border rounded-xl bg-background text-sm resize-none"
                rows={3}
                placeholder="Add a note for the employee..."
                value={reviewNote}
                onChange={e => setReviewNote(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setReviewDialog(null)}>Cancel</Button>
              <Button
                className={`flex-1 ${reviewDialog.action === "approved" ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
                variant={reviewDialog.action === "rejected" ? "destructive" : undefined}
                isLoading={submitting}
                onClick={handleReview}
              >
                {reviewDialog.action === "approved" ? "Confirm Approval" : "Confirm Rejection"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
