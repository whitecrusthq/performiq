import { useState, useMemo, useEffect } from "react";
import { useListAppraisals, useCreateAppraisal, useListCycles, useListUsers } from "../lib";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, Card, StatusBadge, Button, EmptyState, Label } from "@/components/shared";
import { format } from "date-fns";
import { ClipboardList, Plus, X, Search, ChevronDown, ArrowUp, ArrowDown, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

const STATUS_OPTIONS = [
  { value: "self_review",       label: "Self Review" },
  { value: "manager_review",    label: "Manager Review" },
  { value: "pending_approval",  label: "Pending Approval" },
  { value: "completed",         label: "Completed" },
];

export default function Appraisals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
  
  const { data: appraisals, isLoading } = useListAppraisals({}, { request: { headers } });
  const { data: cycles } = useListCycles({ request: { headers } });
  const { data: users } = useListUsers({ request: { headers } });

  const createMutation = useCreateAppraisal({ request: { headers } });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ cycleId: "", employeeId: "", workflowType: "admin_approval", criteriaGroupId: "" });
  const [reviewerSteps, setReviewerSteps] = useState<string[]>([""]); // array of user id strings

  // Criteria groups
  const [criteriaGroups, setCriteriaGroups] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/criteria-groups", { headers: authHeader() })
      .then(r => r.json())
      .then(setCriteriaGroups)
      .catch(() => {});
  }, []);

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCycle, setFilterCycle] = useState("");

  const filteredAppraisals = useMemo(() => {
    if (!appraisals) return [];
    return appraisals.filter(a => {
      const q = search.toLowerCase();
      const matchSearch = !q || (a.employee?.name ?? "").toLowerCase().includes(q) || (a.employee?.department ?? "").toLowerCase().includes(q);
      const matchStatus = !filterStatus || a.status === filterStatus;
      const matchCycle = !filterCycle || String(a.cycleId) === filterCycle;
      return matchSearch && matchStatus && matchCycle;
    });
  }, [appraisals, search, filterStatus, filterCycle]);

  const activeFilters = search || filterStatus || filterCycle;

  const WORKFLOW_OPTIONS = [
    { value: "self_only",      label: "Self Only",           desc: "Employee self-review → Completed" },
    { value: "manager_review", label: "Employee → Manager",  desc: "Self-review → Manager review → Completed" },
    { value: "admin_approval", label: "Full Approval",       desc: "Self-review → Manager review → Admin approval → Completed" },
  ];

  const needsReviewer = formData.workflowType !== "self_only";

  const addReviewerStep = () => setReviewerSteps(prev => [...prev, ""]);
  const removeReviewerStep = (idx: number) => setReviewerSteps(prev => prev.filter((_, i) => i !== idx));
  const moveReviewerStep = (idx: number, dir: -1 | 1) => {
    setReviewerSteps(prev => {
      const next = [...prev];
      const tmp = next[idx]; next[idx] = next[idx + dir]; next[idx + dir] = tmp;
      return next;
    });
  };
  const setReviewerAtStep = (idx: number, val: string) =>
    setReviewerSteps(prev => prev.map((v, i) => i === idx ? val : v));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const reviewerIds = needsReviewer ? reviewerSteps.map(Number).filter(Boolean) : [];
    const payload: any = {
      cycleId: parseInt(formData.cycleId),
      employeeId: parseInt(formData.employeeId),
      workflowType: formData.workflowType,
      reviewerIds,
      criteriaGroupId: formData.criteriaGroupId ? parseInt(formData.criteriaGroupId) : undefined,
    };
    createMutation.mutate(
      { data: payload },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/appraisals"] });
          setIsDialogOpen(false);
          setFormData({ cycleId: "", employeeId: "", workflowType: "admin_approval", criteriaGroupId: "" });
          setReviewerSteps([""]);
        }
      }
    );
  };

  if (isLoading) return <div className="p-8">Loading appraisals...</div>;

  return (
    <div>
      <PageHeader title="Appraisals" description="Manage performance reviews and evaluations.">
        {user?.role !== 'employee' && (
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Start Appraisal
          </Button>
        )}
      </PageHeader>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Search employee or department…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <select
            className="pl-3 pr-8 py-2 rounded-xl border border-border bg-card text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>
        <div className="relative">
          <select
            className="pl-3 pr-8 py-2 rounded-xl border border-border bg-card text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={filterCycle}
            onChange={e => setFilterCycle(e.target.value)}
          >
            <option value="">All Cycles</option>
            {cycles?.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>
        {activeFilters && (
          <button
            className="px-3 py-2 text-xs text-muted-foreground underline hover:text-foreground"
            onClick={() => { setSearch(""); setFilterStatus(""); setFilterCycle(""); }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Result count */}
      {activeFilters && (
        <p className="text-sm text-muted-foreground mb-3">
          Showing {filteredAppraisals.length} of {appraisals?.length ?? 0} appraisals
        </p>
      )}

      <Card className="overflow-hidden">
        {appraisals?.length === 0 ? (
          <EmptyState title="No appraisals found" description="There are no active appraisals right now." icon={ClipboardList} />
        ) : filteredAppraisals.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">No appraisals match the current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-sm font-semibold text-muted-foreground">
                  <th className="p-4">Employee</th>
                  <th className="p-4">Cycle</th>
                  <th className="p-4 hidden md:table-cell">Reviewer</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Score</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAppraisals.map((app) => (
                  <tr key={app.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                          {(app.employee?.name ?? '?').charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{app.employee?.name ?? 'Unknown Employee'}</p>
                          <p className="text-xs text-muted-foreground hidden sm:block">{app.employee?.department || 'No department'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm font-medium">{app.cycle.name}</td>
                    <td className="p-4 hidden md:table-cell text-sm text-muted-foreground">
                      {(app as any).reviewers?.length > 0
                        ? (app as any).reviewers.map((r: any) => r.name).join(', ')
                        : 'Unassigned'}
                    </td>
                    <td className="p-4"><StatusBadge status={app.status} type="appraisal" /></td>
                    <td className="p-4">
                      {app.overallScore !== null ? (
                        <span className="font-bold text-lg">{Number(app.overallScore).toFixed(1)}<span className="text-sm text-muted-foreground font-normal">/5</span></span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <Link href={`/appraisals/${app.id}`}>
                        <Button variant="outline" size="sm">View</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-bold">Start New Appraisal</h2>
              <button onClick={() => setIsDialogOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <Label>Select Employee</Label>
                <select 
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border outline-none focus:ring-2 focus:ring-primary/20"
                  value={formData.employeeId}
                  onChange={e => setFormData({...formData, employeeId: e.target.value})}
                  required
                >
                  <option value="">-- Choose employee --</option>
                  {users?.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Select Cycle</Label>
                <select 
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border outline-none focus:ring-2 focus:ring-primary/20"
                  value={formData.cycleId}
                  onChange={e => setFormData({...formData, cycleId: e.target.value})}
                  required
                >
                  <option value="">-- Choose cycle --</option>
                  {cycles?.filter(c => c.status === 'active').map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Criteria Group <span className="text-muted-foreground font-normal text-xs">(optional — uses all criteria if not selected)</span></Label>
                <select
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border outline-none focus:ring-2 focus:ring-primary/20"
                  value={formData.criteriaGroupId}
                  onChange={e => setFormData({...formData, criteriaGroupId: e.target.value})}
                >
                  <option value="">-- All criteria --</option>
                  {criteriaGroups.map((g: any) => (
                    <option key={g.id} value={g.id}>{g.name} ({g.criteria?.length ?? 0} criteria)</option>
                  ))}
                </select>
              </div>
              {needsReviewer && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Review Chain <span className="text-muted-foreground font-normal text-xs">(sequential — Step 1 reviews first)</span></Label>
                  </div>
                  <div className="space-y-2">
                    {reviewerSteps.map((stepVal, idx) => {
                      const eligible = users?.filter(u =>
                        (u.role === 'manager' || u.role === 'admin' || u.role === 'super_admin') &&
                        u.id !== parseInt(formData.employeeId) &&
                        !reviewerSteps.some((v, i) => i !== idx && v === String(u.id))
                      ) ?? [];
                      return (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">{idx + 1}</span>
                          <select
                            className="flex-1 px-3 py-2 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-primary/20"
                            value={stepVal}
                            onChange={e => setReviewerAtStep(idx, e.target.value)}
                          >
                            <option value="">-- Select manager/admin --</option>
                            {eligible.map(u => (
                              <option key={u.id} value={String(u.id)}>{u.name} ({u.role})</option>
                            ))}
                          </select>
                          <button type="button" onClick={() => moveReviewerStep(idx, -1)} disabled={idx === 0} className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed" title="Move up">
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => moveReviewerStep(idx, 1)} disabled={idx === reviewerSteps.length - 1} className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed" title="Move down">
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          {reviewerSteps.length > 1 && (
                            <button type="button" onClick={() => removeReviewerStep(idx)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Remove step">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={addReviewerStep}
                    className="mt-2 flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium px-2 py-1 rounded-lg hover:bg-primary/5 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" /> Add another reviewer step
                  </button>
                  {needsReviewer && reviewerSteps.every(s => !s) && (
                    <p className="text-xs text-amber-600 mt-1">Please assign at least one reviewer.</p>
                  )}
                </div>
              )}
              <div>
                <Label>Review Route</Label>
                <div className="space-y-2 mt-1">
                  {WORKFLOW_OPTIONS.map(opt => (
                    <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${formData.workflowType === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}>
                      <input
                        type="radio"
                        name="workflowType"
                        value={opt.value}
                        checked={formData.workflowType === opt.value}
                        onChange={() => setFormData({ ...formData, workflowType: opt.value })}
                        className="mt-0.5 accent-primary"
                      />
                      <div>
                        <p className="font-medium text-sm">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" isLoading={createMutation.isPending}>Start Appraisal</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
