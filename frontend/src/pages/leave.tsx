import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, Card, Button, Input, Label } from "@/components/shared";
import { CalendarDays, Plus, X, CheckCircle2, XCircle, Clock, Ban, ChevronRight, UserPlus, ArrowUp, ArrowDown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/utils";

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

const STEP_CONFIG: Record<string, { label: string; color: string }> = {
  pending:  { label: "Pending",  color: "bg-amber-100 text-amber-700 border-amber-200" },
  approved: { label: "Approved", color: "bg-green-100 text-green-700 border-green-200" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700 border-red-200" },
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

interface ApproverStep {
  id: number;
  orderIndex: number;
  status: string;
  note?: string | null;
  reviewedAt?: string | null;
  approver?: { id: number; name: string; department?: string | null } | null;
}

interface LeaveRequest {
  id: number; leaveType: LeaveType; startDate: string; endDate: string;
  days: number; reason?: string | null; status: LeaveStatus;
  reviewNote?: string | null; createdAt: string;
  employee?: { id: number; name: string; department?: string | null } | null;
  reviewer?: { id: number; name: string } | null;
  approvers?: ApproverStep[];
  currentApproverId?: number | null;
}

interface UserOption { id: number; name: string; role: string; department?: string | null }

export default function Leave() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reviewDialog, setReviewDialog] = useState<{ request: LeaveRequest; action: "approved" | "rejected" } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ leaveType: "annual" as LeaveType, startDate: "", endDate: "", reason: "" });
  // Sequential approver chain for the form
  const [approverSteps, setApproverSteps] = useState<string[]>([""]);

  const isManager = user && ["super_admin", "admin", "manager"].includes(user.role);

  const load = async () => {
    setIsLoading(true);
    try {
      const r = await apiFetch("/api/leave-requests", { headers: authHeader() });
      const data = await r.json();
      if (Array.isArray(data)) setRequests(data);
    } catch {}
    setIsLoading(false);
  };

  const loadUsers = async () => {
    try {
      const r = await apiFetch("/api/users", { headers: authHeader() });
      const data = await r.json();
      if (Array.isArray(data)) setAllUsers(data);
    } catch {}
  };

  useEffect(() => { load(); loadUsers(); }, []);

  const days = calcDays(form.startDate, form.endDate);

  // Approver chain helpers
  const addApproverStep = () => setApproverSteps(prev => [...prev, ""]);
  const removeApproverStep = (idx: number) => setApproverSteps(prev => prev.filter((_, i) => i !== idx));
  const moveApproverStep = (idx: number, dir: -1 | 1) => {
    setApproverSteps(prev => {
      const next = [...prev];
      const tmp = next[idx]; next[idx] = next[idx + dir]; next[idx + dir] = tmp;
      return next;
    });
  };
  const setApproverAtStep = (idx: number, val: string) =>
    setApproverSteps(prev => prev.map((v, i) => i === idx ? val : v));

  const eligibleApprovers = allUsers.filter(u =>
    u.id !== user?.id && ["manager", "admin", "super_admin"].includes(u.role)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMutationError(null);
    if (days <= 0) { setMutationError("End date must be on or after start date."); return; }
    setSubmitting(true);
    try {
      const approverIds = approverSteps.map(Number).filter(Boolean);
      const r = await apiFetch("/api/leave-requests", {
        method: "POST", headers: authHeader(),
        body: JSON.stringify({ ...form, days, approverIds }),
      });
      const data = await r.json();
      if (!r.ok) { setMutationError(data.error || "Failed to submit"); setSubmitting(false); return; }
      setIsDialogOpen(false);
      setForm({ leaveType: "annual", startDate: "", endDate: "", reason: "" });
      setApproverSteps([""]);
      load();
    } catch { setMutationError("Network error"); }
    setSubmitting(false);
  };

  const handleCancel = async (id: number) => {
    await apiFetch(`/api/leave-requests/${id}`, { method: "PUT", headers: authHeader(), body: JSON.stringify({ status: "cancelled" }) });
    load();
  };

  const handleReview = async () => {
    if (!reviewDialog) return;
    setSubmitting(true);
    await apiFetch(`/api/leave-requests/${reviewDialog.request.id}`, {
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
        <Button onClick={() => { setMutationError(null); setForm({ leaveType: "annual", startDate: "", endDate: "", reason: "" }); setApproverSteps([""]); setIsDialogOpen(true); }}>
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
          {filtered.map(req => {
            const isCurrentApprover = req.currentApproverId === user?.id;
            const canReview = isManager && req.status === "pending" && (isCurrentApprover || user?.role === "admin" || user?.role === "super_admin");

            return (
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

                    {/* Sequential Approval Chain */}
                    {req.approvers && req.approvers.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-1">
                        <span className="text-xs text-muted-foreground font-medium mr-1">Approval chain:</span>
                        {req.approvers.map((step, i) => {
                          const stepCfg = STEP_CONFIG[step.status] ?? STEP_CONFIG.pending;
                          const isActive = step.status === 'pending' && req.status === 'pending';
                          return (
                            <span key={step.id} className="flex items-center gap-1">
                              {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/50" />}
                              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${stepCfg.color} ${isActive ? 'ring-1 ring-amber-400' : ''}`}>
                                <span className="opacity-60 font-normal">{i + 1}.</span>
                                {step.approver?.name ?? `Approver ${i + 1}`}
                                {step.status === 'approved' && <CheckCircle2 className="w-3 h-3" />}
                                {step.status === 'rejected' && <XCircle className="w-3 h-3" />}
                                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                              </span>
                              {step.note && (
                                <span className="text-xs text-muted-foreground italic">"{step.note}"</span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {req.reviewNote && !req.approvers?.some(a => a.note) && (
                      <p className="text-sm mt-1">
                        <span className="font-medium">{req.reviewer?.name ?? "Reviewer"}:</span> {req.reviewNote}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">Submitted {fmt(req.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {req.status === "pending" && req.employee?.id === user?.id && (
                      <Button variant="outline" size="sm" onClick={() => handleCancel(req.id)}>Cancel</Button>
                    )}
                    {canReview && (
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
            );
          })}
        </div>
      )}

      {/* Apply for Leave Modal */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
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
                  <Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} required />
                </div>
              </div>
              {form.startDate && form.endDate && days > 0 && (
                <p className="text-sm text-primary font-medium">{days} working day{days !== 1 ? "s" : ""} selected</p>
              )}
              <div>
                <Label>Reason <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
                <textarea
                  className="w-full px-4 py-2 border rounded-xl bg-background text-sm resize-none"
                  rows={2}
                  placeholder="Briefly describe the reason for your leave..."
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                />
              </div>

              {/* Sequential Approval Chain */}
              <div>
                <Label>Approval Chain <span className="text-muted-foreground text-xs font-normal">(sequential — Step 1 approves first)</span></Label>
                <div className="mt-2 space-y-2">
                  {approverSteps.map((stepVal, idx) => {
                    const alreadyPicked = new Set(approverSteps.filter((v, i) => i !== idx && v));
                    const available = eligibleApprovers.filter(u => !alreadyPicked.has(String(u.id)));
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold shrink-0">{idx + 1}</span>
                        <select
                          className="flex-1 px-3 py-2 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-primary/20"
                          value={stepVal}
                          onChange={e => setApproverAtStep(idx, e.target.value)}
                        >
                          <option value="">-- Select approver --</option>
                          {available.map(u => (
                            <option key={u.id} value={String(u.id)}>{u.name} ({u.role})</option>
                          ))}
                        </select>
                        <button type="button" onClick={() => moveApproverStep(idx, -1)} disabled={idx === 0} className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed" title="Move up">
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => moveApproverStep(idx, 1)} disabled={idx === approverSteps.length - 1} className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed" title="Move down">
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        {approverSteps.length > 1 && (
                          <button type="button" onClick={() => removeApproverStep(idx)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Remove step">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={addApproverStep}
                  className="mt-2 flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium px-2 py-1 rounded-lg hover:bg-primary/5 transition-colors"
                >
                  <UserPlus className="w-4 h-4" /> Add another approver
                </button>
                <p className="text-xs text-muted-foreground mt-1">Leave blank to use your direct manager by default.</p>
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
            <p className="text-sm text-muted-foreground mb-1">
              {reviewDialog.request.employee?.name} · {LEAVE_LABEL[reviewDialog.request.leaveType]} ·{" "}
              {fmt(reviewDialog.request.startDate)} – {fmt(reviewDialog.request.endDate)} ({reviewDialog.request.days} days)
            </p>
            {/* Show remaining chain if approving */}
            {reviewDialog.action === "approved" && (reviewDialog.request.approvers?.filter(a => a.status === 'pending').length ?? 0) > 1 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
                After your approval, this will move to the next approver in the chain.
              </p>
            )}
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
