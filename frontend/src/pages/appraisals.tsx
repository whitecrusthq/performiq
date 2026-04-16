import { useState, useMemo, useEffect } from "react";
import { useListAppraisals, useCreateAppraisal, useListCycles, useListUsers } from "../lib";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, Card, StatusBadge, Button, EmptyState, Label } from "@/components/shared";
import { format } from "date-fns";
import { ClipboardList, Plus, X, Search, ChevronDown, ArrowUp, ArrowDown, UserPlus, Trash2, Users, User, Check } from "lucide-react";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { apiFetch } from "@/lib/utils";

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
  const [reviewerSteps, setReviewerSteps] = useState<string[]>([""]); 
  const [budgetValues, setBudgetValues] = useState<Record<number, string>>({});
  const [assignMode, setAssignMode] = useState<"individual" | "category">("individual");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<number>>(new Set());
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, Record<number, string>>>({});
  const [bulkCreating, setBulkCreating] = useState(false);

  // Criteria groups
  const [criteriaGroups, setCriteriaGroups] = useState<any[]>([]);
  useEffect(() => {
    apiFetch("/api/criteria-groups")
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
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleSelect = (id: number) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (selectedIds.size === filteredAppraisals.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredAppraisals.map(a => a.id)));
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} selected appraisal(s)? This cannot be undone.`)) return;
    setBulkDeleting(true);
    await Promise.all([...selectedIds].map(id => apiFetch(`/api/appraisals/${id}`, { method: "DELETE" })));
    queryClient.invalidateQueries({ queryKey: ["/api/appraisals"] });
    setSelectedIds(new Set());
    setBulkDeleting(false);
  };

  const handleDeleteOne = async (id: number) => {
    if (!confirm("Delete this appraisal? This cannot be undone.")) return;
    await apiFetch(`/api/appraisals/${id}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["/api/appraisals"] });
  };

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

  const employeesByCategory = useMemo(() => {
    if (!users) return {};
    const grouped: Record<string, typeof users> = {};
    for (const u of users) {
      if (u.role === "super_admin") continue;
      const cat = (u.jobTitle || "Uncategorized").trim();
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(u);
    }
    return grouped;
  }, [users]);

  const toggleCategoryEmployees = (category: string) => {
    const emps = employeesByCategory[category] || [];
    const allSelected = emps.every(e => selectedEmployeeIds.has(e.id));
    setSelectedEmployeeIds(prev => {
      const next = new Set(prev);
      for (const e of emps) {
        if (allSelected) next.delete(e.id); else next.add(e.id);
      }
      return next;
    });
  };

  const setCategoryBudgetValue = (category: string, criterionId: number, value: string) => {
    setCategoryBudgets(prev => ({
      ...prev,
      [category]: { ...(prev[category] || {}), [criterionId]: value },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const reviewerIds = needsReviewer ? reviewerSteps.map(Number).filter(Boolean) : [];

    if (assignMode === "category") {
      if (selectedEmployeeIds.size === 0) return;
      setBulkCreating(true);
      const budgetsByCat: Record<string, Record<number, number>> = {};
      for (const [cat, vals] of Object.entries(categoryBudgets)) {
        budgetsByCat[cat] = {};
        for (const [k, v] of Object.entries(vals)) {
          if (v && Number(v) > 0) budgetsByCat[cat][Number(k)] = Number(v);
        }
      }
      try {
        await apiFetch("/api/appraisals/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cycleId: parseInt(formData.cycleId),
            employeeIds: [...selectedEmployeeIds],
            workflowType: formData.workflowType,
            reviewerIds,
            criteriaGroupId: formData.criteriaGroupId ? parseInt(formData.criteriaGroupId) : undefined,
            budgetsByCategory: Object.keys(budgetsByCat).length > 0 ? budgetsByCat : undefined,
          }),
        });
        queryClient.invalidateQueries({ queryKey: ["/api/appraisals"] });
        setIsDialogOpen(false);
        resetForm();
      } catch { /* handled by apiFetch */ }
      setBulkCreating(false);
      return;
    }

    const budgetMap: Record<number, number> = {};
    for (const [k, v] of Object.entries(budgetValues)) {
      if (v && Number(v) > 0) budgetMap[Number(k)] = Number(v);
    }
    const payload = {
      cycleId: parseInt(formData.cycleId),
      employeeId: parseInt(formData.employeeId),
      workflowType: formData.workflowType,
      reviewerIds,
      criteriaGroupId: formData.criteriaGroupId ? parseInt(formData.criteriaGroupId) : undefined,
      budgetValues: Object.keys(budgetMap).length > 0 ? budgetMap : undefined,
    } as Record<string, unknown>;
    createMutation.mutate(
      { data: payload },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/appraisals"] });
          setIsDialogOpen(false);
          resetForm();
        }
      }
    );
  };

  const resetForm = () => {
    setFormData({ cycleId: "", employeeId: "", workflowType: "admin_approval", criteriaGroupId: "" });
    setReviewerSteps([""]);
    setBudgetValues({});
    setAssignMode("individual");
    setSelectedEmployeeIds(new Set());
    setCategoryBudgets({});
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

      {isAdmin && <BulkActionBar count={selectedIds.size} onDelete={handleBulkDelete} onClear={() => setSelectedIds(new Set())} deleting={bulkDeleting} />}

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
                  {isAdmin && (
                    <th className="p-4 w-10">
                      <input
                        type="checkbox"
                        checked={filteredAppraisals.length > 0 && selectedIds.size === filteredAppraisals.length}
                        onChange={toggleAll}
                        className="w-4 h-4 accent-primary cursor-pointer"
                      />
                    </th>
                  )}
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
                  <tr key={app.id} className={`hover:bg-muted/30 transition-colors ${selectedIds.has(app.id) ? "bg-primary/5" : ""}`}>
                    {isAdmin && (
                      <td className="p-4 w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(app.id)}
                          onChange={() => toggleSelect(app.id)}
                          className="w-4 h-4 accent-primary cursor-pointer"
                        />
                      </td>
                    )}
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
                        <span className="font-bold text-lg">{Number(app.overallScore).toFixed(1)}<span className="text-sm text-muted-foreground font-normal">/5</span> <span className="text-sm text-muted-foreground font-normal">({(Number(app.overallScore) / 5 * 100).toFixed(0)}%)</span></span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/appraisals/${app.id}`}>
                          <Button variant="outline" size="sm">View</Button>
                        </Link>
                        {isAdmin && (
                          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeleteOne(app.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
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
          <Card className={`w-full shadow-2xl animate-in fade-in zoom-in-95 ${assignMode === "category" ? "max-w-lg" : "max-w-md"}`}>
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-bold">Start New Appraisal</h2>
              <button onClick={() => { setIsDialogOpen(false); resetForm(); }} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div>
                <Label>Assignment Mode</Label>
                <div className="flex gap-2 mt-1">
                  <button type="button" onClick={() => setAssignMode("individual")}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${assignMode === "individual" ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted/40"}`}>
                    <User className="w-4 h-4" /> Individual
                  </button>
                  <button type="button" onClick={() => setAssignMode("category")}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${assignMode === "category" ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted/40"}`}>
                    <Users className="w-4 h-4" /> By Category
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {assignMode === "individual" ? "Create an appraisal for a single employee." : "Select employees by job title category with group-level budget targets."}
                </p>
              </div>

              {assignMode === "individual" ? (
                <div>
                  <Label>Select Employee</Label>
                  <select 
                    className="w-full px-4 py-2.5 rounded-xl bg-background border border-border outline-none focus:ring-2 focus:ring-primary/20"
                    value={formData.employeeId}
                    onChange={e => setFormData({...formData, employeeId: e.target.value})}
                    required={assignMode === "individual"}
                  >
                    <option value="">-- Choose employee --</option>
                    {users?.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.jobTitle || u.role})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <Label>Select Employees by Category <span className="text-muted-foreground font-normal text-xs">({selectedEmployeeIds.size} selected)</span></Label>
                  <div className="mt-2 space-y-3 max-h-52 overflow-y-auto border border-border rounded-xl p-3 bg-muted/10">
                    {Object.entries(employeesByCategory).map(([category, emps]) => {
                      const allChecked = emps.every(e => selectedEmployeeIds.has(e.id));
                      const someChecked = emps.some(e => selectedEmployeeIds.has(e.id));
                      return (
                        <div key={category} className="space-y-1">
                          <button type="button" onClick={() => toggleCategoryEmployees(category)}
                            className="flex items-center gap-2 cursor-pointer group w-full text-left">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${allChecked ? "bg-primary border-primary" : someChecked ? "bg-primary/40 border-primary" : "border-border group-hover:border-primary/50"}`}>
                              {(allChecked || someChecked) && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="text-sm font-semibold text-foreground">{category}</span>
                            <span className="text-xs text-muted-foreground">({emps.length})</span>
                          </button>
                          <div className="ml-6 space-y-0.5">
                            {emps.map(emp => (
                              <label key={emp.id} className="flex items-center gap-2 cursor-pointer py-0.5 hover:bg-muted/30 rounded px-1 -mx-1">
                                <input type="checkbox" checked={selectedEmployeeIds.has(emp.id)}
                                  onChange={() => {
                                    setSelectedEmployeeIds(prev => {
                                      const next = new Set(prev);
                                      if (next.has(emp.id)) next.delete(emp.id); else next.add(emp.id);
                                      return next;
                                    });
                                  }}
                                  className="w-3.5 h-3.5 accent-primary" />
                                <span className="text-sm">{emp.name}</span>
                                <span className="text-xs text-muted-foreground">{emp.department || ""}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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
              {formData.criteriaGroupId && (() => {
                const group = criteriaGroups.find((g: any) => String(g.id) === formData.criteriaGroupId);
                const valueCriteria = group?.criteria?.filter((c: any) => c.type === 'value' || c.type === 'percentage') ?? [];
                if (valueCriteria.length === 0) return null;

                if (assignMode === "individual") {
                  return (
                    <div>
                      <Label>Budget / Target Values <span className="text-muted-foreground font-normal text-xs">(set targets for this employee)</span></Label>
                      <div className="space-y-2 mt-2 bg-muted/30 p-3 rounded-xl">
                        {valueCriteria.map((c: any) => (
                          <div key={c.id} className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{c.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Default: {Number(c.targetValue ?? c.target_value ?? 0).toLocaleString()}{c.unit ? ` ${c.unit}` : ""}
                                {(c.targetPeriod ?? c.target_period) && <> · {(c.targetPeriod ?? c.target_period).replace('_', ' ')}</>}
                              </p>
                            </div>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="w-40 px-3 py-2 rounded-lg border border-border text-sm outline-none focus:ring-2 focus:ring-primary/20"
                              placeholder={String(c.targetValue ?? c.target_value ?? "")}
                              value={budgetValues[c.id] ?? ""}
                              onChange={e => setBudgetValues(prev => ({ ...prev, [c.id]: e.target.value }))}
                            />
                            {c.unit && <span className="text-xs text-muted-foreground shrink-0">{c.unit}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                const selectedCategories = [...new Set(
                  [...selectedEmployeeIds].map(id => {
                    const u = users?.find(u => u.id === id);
                    return (u?.jobTitle || "Uncategorized").trim();
                  })
                )];

                if (selectedCategories.length === 0) return null;

                return (
                  <div>
                    <Label>Budget / Target Values by Category</Label>
                    <p className="text-xs text-muted-foreground mb-2">Set different targets for each job category. All employees in a category share the same budget.</p>
                    <div className="space-y-4">
                      {selectedCategories.map(category => (
                        <div key={category} className="bg-muted/30 p-3 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="w-4 h-4 text-primary" />
                            <span className="text-sm font-semibold">{category}</span>
                            <span className="text-xs text-muted-foreground">
                              ({[...selectedEmployeeIds].filter(id => {
                                const u = users?.find(u => u.id === id);
                                return (u?.jobTitle || "Uncategorized").trim() === category;
                              }).length} employees)
                            </span>
                          </div>
                          <div className="space-y-2 ml-6">
                            {valueCriteria.map((c: any) => (
                              <div key={c.id} className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{c.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Default: {Number(c.targetValue ?? c.target_value ?? 0).toLocaleString()}{c.unit ? ` ${c.unit}` : ""}
                                  </p>
                                </div>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="w-36 px-3 py-2 rounded-lg border border-border text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                  placeholder={String(c.targetValue ?? c.target_value ?? "")}
                                  value={categoryBudgets[category]?.[c.id] ?? ""}
                                  onChange={e => setCategoryBudgetValue(category, c.id, e.target.value)}
                                />
                                {c.unit && <span className="text-xs text-muted-foreground shrink-0">{c.unit}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
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
                <Button type="button" variant="ghost" onClick={() => { setIsDialogOpen(false); resetForm(); }}>Cancel</Button>
                {assignMode === "category" ? (
                  <Button type="submit" isLoading={bulkCreating} disabled={selectedEmployeeIds.size === 0}>
                    Start {selectedEmployeeIds.size} Appraisal{selectedEmployeeIds.size !== 1 ? "s" : ""}
                  </Button>
                ) : (
                  <Button type="submit" isLoading={createMutation.isPending}>Start Appraisal</Button>
                )}
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
