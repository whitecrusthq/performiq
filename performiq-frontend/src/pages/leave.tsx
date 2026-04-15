import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, Card, Button, Input, Label } from "@/components/shared";
import { CalendarDays, Plus, X, CheckCircle2, XCircle, Clock, Ban, ChevronRight, UserPlus, ArrowUp, ArrowDown, Trash2, Settings, BarChart3, Filter, Users, Tag, Pencil } from "lucide-react";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/utils";

type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

interface LeaveTypeOption { id: number; name: string; label: string; isDefault: boolean }

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

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

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
  id: number; leaveType: string; startDate: string; endDate: string;
  days: number; reason?: string | null; status: LeaveStatus;
  reviewNote?: string | null; createdAt: string;
  employee?: { id: number; name: string; department?: string | null } | null;
  reviewer?: { id: number; name: string } | null;
  approvers?: ApproverStep[];
  currentApproverId?: number | null;
}

interface UserOption { id: number; name: string; role: string; department?: string | null }

interface LeavePolicy {
  id: number; leaveType: string; daysAllocated: number;
  cycleStartMonth: number; cycleStartDay: number;
  cycleEndMonth: number; cycleEndDay: number;
}

interface LeaveBalanceItem {
  leaveType: string; allocated: number; used: number; remaining: number;
  policy?: LeavePolicy | null;
}

type TabType = "requests" | "balance" | "policies";

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
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ leaveType: "annual", startDate: "", endDate: "", reason: "" });
  const [approverSteps, setApproverSteps] = useState<string[]>([""]);
  const [activeTab, setActiveTab] = useState<TabType>("requests");
  const [balances, setBalances] = useState<LeaveBalanceItem[]>([]);
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [policyForm, setPolicyForm] = useState<Partial<LeavePolicy> & { leaveType: string }>({
    leaveType: "annual", daysAllocated: 0,
    cycleStartMonth: 1, cycleStartDay: 1, cycleEndMonth: 12, cycleEndDay: 31,
  });
  const [isPolicyDialogOpen, setIsPolicyDialogOpen] = useState(false);
  const [teamBalances, setTeamBalances] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeOption[]>([]);
  const [isLeaveTypeDialogOpen, setIsLeaveTypeDialogOpen] = useState(false);
  const [leaveTypeForm, setLeaveTypeForm] = useState({ name: "", label: "" });
  const [editingLeaveType, setEditingLeaveType] = useState<LeaveTypeOption | null>(null);

  const isManager = user && ["super_admin", "admin", "manager"].includes(user.role);
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const departments = [...new Set(allUsers.map(u => u.department).filter(Boolean))] as string[];

  const leaveLabel = (name: string) => {
    const found = leaveTypes.find(t => t.name === name);
    return found ? found.label : name;
  };

  const load = async () => {
    setIsLoading(true);
    try {
      let url = "/api/leave-requests";
      const params: string[] = [];
      if (filterDepartment !== "all") params.push(`department=${encodeURIComponent(filterDepartment)}`);
      if (filterEmployee !== "all") params.push(`employeeId=${filterEmployee}`);
      if (params.length > 0) url += "?" + params.join("&");
      const r = await apiFetch(url);
      const data = await r.json();
      if (Array.isArray(data)) setRequests(data);
    } catch {}
    setIsLoading(false);
  };

  const loadUsers = async () => {
    try {
      const r = await apiFetch("/api/users");
      const data = await r.json();
      if (Array.isArray(data)) setAllUsers(data);
    } catch {}
  };

  const loadBalances = async () => {
    try {
      const r = await apiFetch("/api/leave-balance");
      const data = await r.json();
      if (data.balances) setBalances(data.balances);
    } catch {}
  };

  const loadPolicies = async () => {
    try {
      const r = await apiFetch("/api/leave-policies");
      const data = await r.json();
      if (Array.isArray(data)) setPolicies(data);
    } catch {}
  };

  const loadTeamBalances = async () => {
    try {
      const r = await apiFetch("/api/leave-balance/team");
      const data = await r.json();
      if (data.employees) setTeamBalances(data.employees);
    } catch {}
  };

  const loadLeaveTypes = async () => {
    try {
      const r = await apiFetch("/api/leave-types");
      const data = await r.json();
      if (Array.isArray(data)) setLeaveTypes(data);
    } catch {}
  };

  const handleSaveLeaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingLeaveType) {
        const r = await apiFetch(`/api/leave-types/${editingLeaveType.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: leaveTypeForm.label }),
        });
        if (r.ok) { setIsLeaveTypeDialogOpen(false); loadLeaveTypes(); setEditingLeaveType(null); }
        else { const d = await r.json(); setMutationError(d.error || "Failed to update"); }
      } else {
        const r = await apiFetch("/api/leave-types", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(leaveTypeForm),
        });
        if (r.ok) { setIsLeaveTypeDialogOpen(false); loadLeaveTypes(); }
        else { const d = await r.json(); setMutationError(d.error || "Failed to create"); }
      }
    } catch {}
    setSubmitting(false);
  };

  const handleDeleteLeaveType = async (lt: LeaveTypeOption) => {
    if (!confirm(`Delete "${lt.label}"? This cannot be undone.`)) return;
    try {
      const r = await apiFetch(`/api/leave-types/${lt.id}`, { method: "DELETE" });
      if (r.ok) loadLeaveTypes();
      else { const d = await r.json(); setMutationError(d.error || "Failed to delete"); }
    } catch {}
  };

  useEffect(() => { load(); loadUsers(); loadBalances(); loadPolicies(); loadLeaveTypes(); if (isManager) loadTeamBalances(); }, []);
  useEffect(() => { load(); }, [filterDepartment, filterEmployee]);

  const days = calcDays(form.startDate, form.endDate);

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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, days, approverIds }),
      });
      const data = await r.json();
      if (!r.ok) { setMutationError(data.error || "Failed to submit"); setSubmitting(false); return; }
      setIsDialogOpen(false);
      setForm({ leaveType: "annual", startDate: "", endDate: "", reason: "" });
      setApproverSteps([""]);
      load();
      loadBalances();
    } catch { setMutationError("Network error"); }
    setSubmitting(false);
  };

  const handleCancel = async (id: number) => {
    await apiFetch(`/api/leave-requests/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) });
    load();
    loadBalances();
  };

  const handleReview = async () => {
    if (!reviewDialog) return;
    setSubmitting(true);
    await apiFetch(`/api/leave-requests/${reviewDialog.request.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: reviewDialog.action, reviewNote }),
    });
    setReviewDialog(null);
    setReviewNote("");
    setSubmitting(false);
    load();
    loadBalances();
    if (isManager) loadTeamBalances();
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const r = await apiFetch("/api/leave-policies", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policyForm),
      });
      if (r.ok) {
        setIsPolicyDialogOpen(false);
        loadPolicies();
        loadBalances();
        if (isManager) loadTeamBalances();
      }
    } catch {}
    setSubmitting(false);
  };

  const handleDeletePolicy = async (id: number) => {
    if (!confirm("Delete this leave policy?")) return;
    await apiFetch(`/api/leave-policies/${id}`, { method: "DELETE" });
    loadPolicies();
  };

  const filtered = filterStatus === "all" ? requests : requests.filter(r => r.status === filterStatus);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleSelect = (id: number) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(r => r.id)));
  };

  const handleDeleteOne = async (id: number) => {
    if (!confirm("Delete this leave request?")) return;
    await apiFetch(`/api/leave-requests/${id}`, { method: "DELETE" });
    load();
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} selected leave request(s)?`)) return;
    setBulkDeleting(true);
    await Promise.all([...selectedIds].map(id => apiFetch(`/api/leave-requests/${id}`, { method: "DELETE" })));
    load();
    setSelectedIds(new Set());
    setBulkDeleting(false);
  };

  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: "requests", label: "Leave Requests", icon: <CalendarDays className="w-4 h-4" /> },
    { key: "balance", label: "Leave Balance", icon: <BarChart3 className="w-4 h-4" /> },
    ...(isAdmin ? [{ key: "policies" as TabType, label: "Leave Policies", icon: <Settings className="w-4 h-4" /> }] : []),
  ];

  return (
    <div>
      <PageHeader title="Leave Management" description="Apply for leave, track balances, and manage leave policies.">
        <Button onClick={() => { setMutationError(null); setForm({ leaveType: "annual", startDate: "", endDate: "", reason: "" }); setApproverSteps([""]); setIsDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Apply for Leave
        </Button>
      </PageHeader>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-secondary/50 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === t.key ? "bg-blue-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Balance Cards - always visible at top when on requests or balance tab */}
      {(activeTab === "requests" || activeTab === "balance") && balances.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
          {balances.map(b => {
            const pct = b.allocated > 0 ? Math.round((b.used / b.allocated) * 100) : 0;
            return (
              <Card key={b.leaveType} className="p-4">
                <p className="text-xs font-medium text-muted-foreground mb-1">{leaveLabel(b.leaveType)}</p>
                <div className="flex items-baseline gap-1.5 mb-2">
                  <span className="text-2xl font-bold text-foreground">{b.remaining}</span>
                  <span className="text-xs text-muted-foreground">/ {b.allocated}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all ${pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-green-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{b.used} used</p>
              </Card>
            );
          })}
        </div>
      )}

      {/* REQUESTS TAB */}
      {activeTab === "requests" && (
        <>
          {/* Filters */}
          {isManager && (
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <select
                  className="px-3 py-1.5 rounded-lg border bg-background text-sm"
                  value={filterDepartment}
                  onChange={e => setFilterDepartment(e.target.value)}
                >
                  <option value="all">All Departments</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <select
                  className="px-3 py-1.5 rounded-lg border bg-background text-sm"
                  value={filterEmployee}
                  onChange={e => setFilterEmployee(e.target.value)}
                >
                  <option value="all">All Employees</option>
                  {allUsers
                    .filter(u => filterDepartment === "all" || u.department === filterDepartment)
                    .map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Status filters */}
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
            <>
              {isAdmin && <BulkActionBar count={selectedIds.size} onDelete={handleBulkDelete} onClear={() => setSelectedIds(new Set())} deleting={bulkDeleting} />}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(req => {
                const isCurrentApprover = req.currentApproverId === user?.id;
                const canReview = isManager && req.status === "pending" && (isCurrentApprover || user?.role === "admin" || user?.role === "super_admin");

                return (
                  <Card key={req.id} className={`p-5 flex flex-col gap-3 ${selectedIds.has(req.id) ? "ring-2 ring-primary/30" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {isAdmin && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(req.id)}
                            onChange={() => toggleSelect(req.id)}
                            className="w-4 h-4 accent-primary cursor-pointer shrink-0"
                          />
                        )}
                        <span className="font-semibold text-foreground truncate">{leaveLabel(req.leaveType)}</span>
                      </div>
                      <StatusBadge status={req.status} />
                    </div>

                    {isManager && req.employee && (
                      <p className="text-sm text-muted-foreground -mt-1">
                        <span className="font-medium text-foreground">{req.employee.name}</span>
                        {req.employee.department && <span> · {req.employee.department}</span>}
                      </p>
                    )}

                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                      {fmt(req.startDate)} – {fmt(req.endDate)}
                      <span className="ml-1 font-medium text-foreground">{req.days}d</span>
                    </p>

                    {req.reason && (
                      <p className="text-sm text-muted-foreground line-clamp-2">"{req.reason}"</p>
                    )}

                    {req.approvers && req.approvers.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-xs text-muted-foreground font-medium w-full mb-0.5">Approval chain:</span>
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
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {req.reviewNote && !req.approvers?.some(a => a.note) && (
                      <p className="text-sm text-muted-foreground italic">"{req.reviewNote}"</p>
                    )}

                    <p className="text-xs text-muted-foreground mt-auto">Submitted {fmt(req.createdAt)}</p>

                    {(req.status === "pending" && req.employee?.id === user?.id) || canReview ? (
                      <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
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
                    ) : null}
                  </Card>
                );
              })}
              </div>
            </>
          )}
        </>
      )}

      {/* BALANCE TAB */}
      {activeTab === "balance" && (
        <div className="space-y-6">
          {isManager && teamBalances.length > 0 && (
            <>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Team Leave Balances
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Employee</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Department</th>
                      {policies.map(p => (
                        <th key={p.leaveType} className="text-center py-3 px-3 font-semibold text-foreground">
                          {leaveLabel(p.leaveType)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {teamBalances.map((emp: any) => (
                      <tr key={emp.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-3 px-4 font-medium">{emp.name}</td>
                        <td className="py-3 px-4 text-muted-foreground">{emp.department || "-"}</td>
                        {policies.map(p => {
                          const bal = emp.balances?.find((b: any) => b.leaveType === p.leaveType);
                          if (!bal) return <td key={p.leaveType} className="text-center py-3 px-3 text-muted-foreground">-</td>;
                          const pct = bal.allocated > 0 ? Math.round((bal.used / bal.allocated) * 100) : 0;
                          return (
                            <td key={p.leaveType} className="text-center py-3 px-3">
                              <div className="inline-flex flex-col items-center gap-1">
                                <span className={`text-sm font-bold ${pct > 80 ? "text-red-600" : pct > 50 ? "text-amber-600" : "text-green-600"}`}>
                                  {bal.remaining}
                                </span>
                                <span className="text-xs text-muted-foreground">{bal.used}/{bal.allocated}</span>
                                <div className="w-12 bg-secondary rounded-full h-1 overflow-hidden">
                                  <div
                                    className={`h-1 rounded-full ${pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-green-500"}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {balances.length === 0 && (
            <Card className="p-12 flex flex-col items-center gap-3 text-center">
              <BarChart3 className="w-10 h-10 text-muted-foreground/40" />
              <p className="font-medium text-muted-foreground">No leave policies configured</p>
              <p className="text-sm text-muted-foreground">
                {isAdmin ? "Go to the Policies tab to set up leave types and allocations." : "Your administrator has not set up leave policies yet."}
              </p>
            </Card>
          )}
        </div>
      )}

      {/* POLICIES TAB */}
      {activeTab === "policies" && isAdmin && (
        <div className="space-y-6">
          {/* Leave Types Section */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground">Leave Types</h3>
            <Button onClick={() => { setLeaveTypeForm({ name: "", label: "" }); setEditingLeaveType(null); setIsLeaveTypeDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Add Leave Type
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {leaveTypes.map(lt => (
              <Card key={lt.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Tag className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="font-medium text-foreground text-sm">{lt.label}</p>
                    <p className="text-xs text-muted-foreground">{lt.name}{lt.isDefault ? " · Default" : ""}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setEditingLeaveType(lt); setLeaveTypeForm({ name: lt.name, label: lt.label }); setIsLeaveTypeDialogOpen(true); }}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {!lt.isDefault && (
                    <button onClick={() => handleDeleteLeaveType(lt)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>

          <hr className="border-border" />

          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground">Leave Cycle Settings</h3>
            <Button onClick={() => {
              setPolicyForm({ leaveType: "annual", daysAllocated: 0, cycleStartMonth: 1, cycleStartDay: 1, cycleEndMonth: 12, cycleEndDay: 31 });
              setIsPolicyDialogOpen(true);
            }}>
              <Plus className="w-4 h-4 mr-2" /> Add Policy
            </Button>
          </div>

          {policies.length === 0 ? (
            <Card className="p-12 flex flex-col items-center gap-3 text-center">
              <Settings className="w-10 h-10 text-muted-foreground/40" />
              <p className="font-medium text-muted-foreground">No leave policies configured</p>
              <p className="text-sm text-muted-foreground">Create policies to define leave types, allocations, and cycle dates.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {policies.map(p => (
                <Card key={p.id} className="p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <h4 className="font-semibold text-foreground">{leaveLabel(p.leaveType)}</h4>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setPolicyForm(p); setIsPolicyDialogOpen(true); }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                        title="Edit"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePolicy(p.id)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Days Allocated</span>
                      <span className="font-bold text-foreground">{p.daysAllocated} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cycle Start</span>
                      <span className="font-medium">{p.cycleStartDay} {MONTHS[p.cycleStartMonth - 1]}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cycle End</span>
                      <span className="font-medium">{p.cycleEndDay} {MONTHS[p.cycleEndMonth - 1]}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
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

              {/* Show balance for selected leave type */}
              {balances.length > 0 && (() => {
                const bal = balances.find(b => b.leaveType === form.leaveType);
                if (!bal) return null;
                return (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="text-sm">
                      <span className="text-blue-700 font-medium">Available: </span>
                      <span className="text-blue-900 font-bold">{bal.remaining} days</span>
                      <span className="text-blue-600 text-xs ml-2">({bal.used} of {bal.allocated} used)</span>
                    </div>
                  </div>
                );
              })()}

              <div>
                <Label>Leave Type</Label>
                <select
                  className="w-full px-4 py-2 border rounded-xl bg-background text-sm"
                  value={form.leaveType}
                  onChange={e => setForm({ ...form, leaveType: e.target.value })}
                  required
                >
                  {leaveTypes.map(t => <option key={t.name} value={t.name}>{t.label}</option>)}
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
              {reviewDialog.request.employee?.name} · {leaveLabel(reviewDialog.request.leaveType)} ·{" "}
              {fmt(reviewDialog.request.startDate)} – {fmt(reviewDialog.request.endDate)} ({reviewDialog.request.days} days)
            </p>
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

      {/* Policy Modal */}
      {isPolicyDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-xl font-bold">{policyForm.id ? "Edit" : "Add"} Leave Policy</h2>
              <button onClick={() => setIsPolicyDialogOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSavePolicy} className="space-y-4 p-6">
              <div>
                <Label>Leave Type</Label>
                <select
                  className="w-full px-4 py-2 border rounded-xl bg-background text-sm"
                  value={policyForm.leaveType}
                  onChange={e => setPolicyForm({ ...policyForm, leaveType: e.target.value })}
                  required
                >
                  {leaveTypes.map(t => <option key={t.name} value={t.name}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <Label>Days Allocated Per Year</Label>
                <input
                  type="number"
                  className="w-full px-4 py-2 border rounded-xl bg-background text-sm"
                  min={0}
                  value={policyForm.daysAllocated ?? ""}
                  onChange={e => setPolicyForm({ ...policyForm, daysAllocated: e.target.value === "" ? 0 : Number(e.target.value) })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Cycle Start Month</Label>
                  <select
                    className="w-full px-4 py-2 border rounded-xl bg-background text-sm"
                    value={policyForm.cycleStartMonth ?? 1}
                    onChange={e => setPolicyForm({ ...policyForm, cycleStartMonth: Number(e.target.value) })}
                  >
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Cycle Start Day</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={policyForm.cycleStartDay ?? 1}
                    onChange={e => setPolicyForm({ ...policyForm, cycleStartDay: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Cycle End Month</Label>
                  <select
                    className="w-full px-4 py-2 border rounded-xl bg-background text-sm"
                    value={policyForm.cycleEndMonth ?? 12}
                    onChange={e => setPolicyForm({ ...policyForm, cycleEndMonth: Number(e.target.value) })}
                  >
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Cycle End Day</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={policyForm.cycleEndDay ?? 31}
                    onChange={e => setPolicyForm({ ...policyForm, cycleEndDay: Number(e.target.value) })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">This will automatically allocate the specified days to all employees for the current cycle year.</p>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsPolicyDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="flex-1" isLoading={submitting}>Save Policy</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave Type Dialog */}
      {isLeaveTypeDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setIsLeaveTypeDialogOpen(false)}>
          <div className="bg-background rounded-2xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 pb-2">
              <h2 className="text-lg font-bold text-foreground">{editingLeaveType ? "Edit Leave Type" : "New Leave Type"}</h2>
              <button onClick={() => setIsLeaveTypeDialogOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveLeaveType} className="space-y-4 p-6">
              {!editingLeaveType && (
                <div>
                  <Label>Name (identifier)</Label>
                  <Input
                    placeholder="e.g. compassionate"
                    value={leaveTypeForm.name}
                    onChange={e => setLeaveTypeForm({ ...leaveTypeForm, name: e.target.value })}
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">Lowercase letters and spaces. Will be auto-formatted.</p>
                </div>
              )}
              <div>
                <Label>Display Label</Label>
                <Input
                  placeholder="e.g. Compassionate Leave"
                  value={leaveTypeForm.label}
                  onChange={e => setLeaveTypeForm({ ...leaveTypeForm, label: e.target.value })}
                  required
                />
              </div>
              {mutationError && <p className="text-sm text-red-600">{mutationError}</p>}
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsLeaveTypeDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="flex-1" isLoading={submitting}>{editingLeaveType ? "Update" : "Create"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
