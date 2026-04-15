import { useState, useEffect } from "react";
import { PageHeader, Card, Button, Input, Label } from "@/components/shared";
import { ArrowRightLeft, Plus, X, CheckCircle2, XCircle, Clock, Ban, MapPin, Building2, Calendar, User, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/utils";

type TransferStatus = "pending" | "approved" | "rejected" | "cancelled";

const STATUS_CONFIG: Record<TransferStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending:   { label: "Pending",   color: "bg-amber-100 text-amber-700",   icon: <Clock className="w-3.5 h-3.5" /> },
  approved:  { label: "Approved",  color: "bg-green-100 text-green-700",   icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  rejected:  { label: "Rejected",  color: "bg-red-100 text-red-700",       icon: <XCircle className="w-3.5 h-3.5" /> },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-500",     icon: <Ban className="w-3.5 h-3.5" /> },
};

function StatusBadge({ status }: { status: TransferStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function fmt(d: string) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

interface Site { id: number; name: string; region?: string | null; city?: string | null }
interface UserOption { id: number; name: string; role: string; department?: string | null; siteId?: number | null }
interface TransferRequest {
  id: number;
  employeeId: number;
  fromSiteId: number | null;
  toSiteId: number;
  fromDepartment: string | null;
  toDepartment: string | null;
  reason: string;
  effectiveDate: string;
  status: TransferStatus;
  requestedById: number;
  approvedById: number | null;
  approvalNotes: string | null;
  approvedAt: string | null;
  createdAt: string;
  employee?: { id: number; name: string; department?: string | null; jobTitle?: string | null } | null;
  requestedBy?: { id: number; name: string } | null;
  approvedBy?: { id: number; name: string } | null;
  fromSite?: Site | null;
  toSite?: Site | null;
}

export default function Transfers() {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reviewDialog, setReviewDialog] = useState<{ transfer: TransferRequest; action: "approved" | "rejected" } | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState({
    employeeId: "",
    fromSiteId: "",
    toSiteId: "",
    fromDepartment: "",
    toDepartment: "",
    reason: "",
    effectiveDate: "",
  });

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const departments = [...new Set(allUsers.map(u => u.department).filter(Boolean))] as string[];

  const load = async () => {
    setIsLoading(true);
    try {
      const r = await apiFetch("/api/transfers");
      const data = await r.json();
      if (Array.isArray(data)) setTransfers(data);
    } catch {}
    setIsLoading(false);
  };

  const loadSites = async () => {
    try {
      const r = await apiFetch("/api/sites");
      const data = await r.json();
      if (Array.isArray(data)) setSites(data);
    } catch {}
  };

  const loadUsers = async () => {
    try {
      const r = await apiFetch("/api/users");
      const data = await r.json();
      if (Array.isArray(data)) setAllUsers(data);
    } catch {}
  };

  useEffect(() => { load(); loadSites(); loadUsers(); }, []);

  const handleEmployeeChange = (empId: string) => {
    const emp = allUsers.find(u => u.id === Number(empId));
    setForm(prev => ({
      ...prev,
      employeeId: empId,
      fromSiteId: emp?.siteId ? String(emp.siteId) : "",
      fromDepartment: emp?.department ?? "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMutationError(null);
    if (!form.employeeId || !form.toSiteId || !form.reason || !form.effectiveDate) {
      setMutationError("Please fill in all required fields."); return;
    }
    if (form.fromSiteId && form.fromSiteId === form.toSiteId && form.fromDepartment === form.toDepartment) {
      setMutationError("Destination must be different from current site/department."); return;
    }
    setSubmitting(true);
    try {
      const r = await apiFetch("/api/transfers", {
        method: "POST",
        body: JSON.stringify({
          employeeId: Number(form.employeeId),
          fromSiteId: form.fromSiteId ? Number(form.fromSiteId) : null,
          toSiteId: Number(form.toSiteId),
          fromDepartment: form.fromDepartment || null,
          toDepartment: form.toDepartment || null,
          reason: form.reason,
          effectiveDate: form.effectiveDate,
        }),
      });
      const data = await r.json();
      if (!r.ok) { setMutationError(data.error || "Failed to submit"); setSubmitting(false); return; }
      setIsDialogOpen(false);
      setForm({ employeeId: "", fromSiteId: "", toSiteId: "", fromDepartment: "", toDepartment: "", reason: "", effectiveDate: "" });
      load();
    } catch { setMutationError("Network error"); }
    setSubmitting(false);
  };

  const handleReview = async () => {
    if (!reviewDialog) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/transfers/${reviewDialog.transfer.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: reviewDialog.action, approvalNotes: reviewNotes }),
      });
      setReviewDialog(null);
      setReviewNotes("");
      load();
    } catch {}
    setSubmitting(false);
  };

  const handleCancel = async (id: number) => {
    if (!confirm("Cancel this transfer request?")) return;
    await apiFetch(`/api/transfers/${id}`, {
      method: "PUT",
      body: JSON.stringify({ status: "cancelled" }),
    });
    load();
  };

  const filtered = filterStatus === "all" ? transfers : transfers.filter(t => t.status === filterStatus);

  return (
    <div>
      <PageHeader title="Staff Transfers" description="Request and manage staff transfers between sites, branches, and regions.">
        <Button onClick={() => { setMutationError(null); setForm({ employeeId: "", fromSiteId: "", toSiteId: "", fromDepartment: "", toDepartment: "", reason: "", effectiveDate: "" }); setIsDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> New Transfer
        </Button>
      </PageHeader>

      <div className="flex flex-wrap gap-2 mb-6">
        {["all", "pending", "approved", "rejected", "cancelled"].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filterStatus === s ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
          >
            {s === "all" ? "All" : STATUS_CONFIG[s as TransferStatus]?.label ?? s}
            {" "}
            <span className="opacity-70">
              ({s === "all" ? transfers.length : transfers.filter(t => t.status === s).length})
            </span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 flex flex-col items-center gap-3 text-center">
          <ArrowRightLeft className="w-10 h-10 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">No transfer requests found</p>
          <p className="text-sm text-muted-foreground">Click "New Transfer" to initiate a staff transfer.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => (
            <Card key={t.id} className="overflow-hidden">
              <button
                className="w-full p-5 flex items-center gap-4 text-left hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{t.employee?.name ?? "—"}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {t.fromSite?.name ?? "—"} → {t.toSite?.name ?? "—"}
                    {(t.fromDepartment || t.toDepartment) && (
                      <span className="ml-2 text-xs">
                        ({t.fromDepartment ?? "—"} → {t.toDepartment ?? t.fromDepartment ?? "Same"})
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground hidden sm:inline">{fmt(t.effectiveDate)}</span>
                  <StatusBadge status={t.status} />
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expandedId === t.id ? "rotate-180" : ""}`} />
                </div>
              </button>

              {expandedId === t.id && (
                <div className="border-t border-border px-5 py-4 bg-muted/10 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Employee</p>
                      <p className="font-medium">{t.employee?.name ?? "—"}</p>
                      {t.employee?.jobTitle && <p className="text-xs text-muted-foreground">{t.employee.jobTitle}</p>}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">From Site</p>
                      <p className="font-medium">{t.fromSite?.name ?? "—"}</p>
                      {t.fromSite?.region && <p className="text-xs text-muted-foreground">{t.fromSite.region}</p>}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">To Site</p>
                      <p className="font-medium">{t.toSite?.name ?? "—"}</p>
                      {t.toSite?.region && <p className="text-xs text-muted-foreground">{t.toSite.region}</p>}
                    </div>
                    {t.fromDepartment && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">From Dept</p>
                        <p className="font-medium">{t.fromDepartment}</p>
                      </div>
                    )}
                    {t.toDepartment && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">To Dept</p>
                        <p className="font-medium">{t.toDepartment}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Effective Date</p>
                      <p className="font-medium">{fmt(t.effectiveDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Requested By</p>
                      <p className="font-medium">{t.requestedBy?.name ?? "—"}</p>
                    </div>
                    {t.approvedBy && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">{t.status === "approved" ? "Approved By" : "Reviewed By"}</p>
                        <p className="font-medium">{t.approvedBy.name}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Reason</p>
                    <p className="text-sm bg-background rounded-lg p-3 border border-border/50">{t.reason}</p>
                  </div>

                  {t.approvalNotes && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Review Notes</p>
                      <p className="text-sm bg-background rounded-lg p-3 border border-border/50 italic">{t.approvalNotes}</p>
                    </div>
                  )}

                  {t.status === "pending" && (
                    <div className="flex gap-2 pt-2">
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => { setReviewDialog({ transfer: t, action: "approved" }); setReviewNotes(""); }}
                            className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Approve
                          </button>
                          <button
                            onClick={() => { setReviewDialog({ transfer: t, action: "rejected" }); setReviewNotes(""); }}
                            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors flex items-center gap-1.5"
                          >
                            <XCircle className="w-4 h-4" /> Reject
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleCancel(t.id)}
                        className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors flex items-center gap-1.5"
                      >
                        <Ban className="w-4 h-4" /> Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* New Transfer Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <form onSubmit={handleSubmit} className="bg-background rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-primary" /> New Transfer Request
              </h2>
              <button type="button" onClick={() => setIsDialogOpen(false)} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
            </div>

            {mutationError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg">{mutationError}</div>}

            <div>
              <Label className="text-sm font-medium">Employee *</Label>
              <select
                className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
                value={form.employeeId}
                onChange={e => handleEmployeeChange(e.target.value)}
                required
              >
                <option value="">Select employee...</option>
                {allUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name} {u.department ? `(${u.department})` : ""}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">From Site</Label>
                <select
                  className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
                  value={form.fromSiteId}
                  onChange={e => setForm(prev => ({ ...prev, fromSiteId: e.target.value }))}
                >
                  <option value="">—</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name} {s.region ? `(${s.region})` : ""}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-sm font-medium">To Site *</Label>
                <select
                  className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
                  value={form.toSiteId}
                  onChange={e => setForm(prev => ({ ...prev, toSiteId: e.target.value }))}
                  required
                >
                  <option value="">Select site...</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name} {s.region ? `(${s.region})` : ""}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">From Department</Label>
                <Input
                  value={form.fromDepartment}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, fromDepartment: e.target.value }))}
                  placeholder="Current department"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">To Department</Label>
                <select
                  className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
                  value={form.toDepartment}
                  onChange={e => setForm(prev => ({ ...prev, toDepartment: e.target.value }))}
                >
                  <option value="">Same department</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Effective Date *</Label>
              <Input
                type="date"
                value={form.effectiveDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, effectiveDate: e.target.value }))}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Reason for Transfer *</Label>
              <textarea
                className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm min-h-[80px] resize-y"
                value={form.reason}
                onChange={e => setForm(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Explain the reason for this transfer..."
                required
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting ? "Submitting..." : "Submit Transfer Request"}
              </Button>
              <button type="button" onClick={() => setIsDialogOpen(false)} className="px-4 py-2 rounded-lg bg-secondary text-sm font-medium hover:bg-secondary/80">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Review Dialog */}
      {reviewDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <h2 className="text-lg font-bold">
              {reviewDialog.action === "approved" ? "Approve" : "Reject"} Transfer
            </h2>
            <p className="text-sm text-muted-foreground">
              {reviewDialog.action === "approved"
                ? `Approving will move ${reviewDialog.transfer.employee?.name ?? "the employee"} to ${reviewDialog.transfer.toSite?.name ?? "the new site"} on ${fmt(reviewDialog.transfer.effectiveDate)}.`
                : `Are you sure you want to reject this transfer request for ${reviewDialog.transfer.employee?.name ?? "the employee"}?`}
            </p>
            <div>
              <Label className="text-sm font-medium">Notes (optional)</Label>
              <textarea
                className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm min-h-[60px] resize-y"
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                placeholder="Add any notes..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleReview}
                disabled={submitting}
                className={`flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors ${reviewDialog.action === "approved" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
              >
                {submitting ? "Processing..." : reviewDialog.action === "approved" ? "Confirm Approval" : "Confirm Rejection"}
              </button>
              <button onClick={() => setReviewDialog(null)} className="px-4 py-2 rounded-lg bg-secondary text-sm font-medium hover:bg-secondary/80">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
