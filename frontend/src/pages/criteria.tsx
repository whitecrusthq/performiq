import { useState, useEffect } from "react";
import { useListCriteria, useCreateCriterion, useUpdateCriterion, useDeleteCriterion } from "../lib";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, Card, Button, Input, Label, EmptyState } from "@/components/shared";
import { ListChecks, Plus, X, Trash2, Edit2, Layers, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/utils";

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

type CriteriaType = "rating" | "percentage" | "value";

interface CriteriaGroup {
  id: number;
  name: string;
  description?: string;
  criteria: any[];
  createdAt: string;
}

const TYPE_LABELS: Record<CriteriaType, { label: string; color: string; desc: string }> = {
  rating:     { label: "Rating",     color: "bg-violet-100 text-violet-700",  desc: "Score 1–5" },
  percentage: { label: "Percentage", color: "bg-amber-100 text-amber-700",    desc: "% of target" },
  value:      { label: "Value",      color: "bg-emerald-100 text-emerald-700", desc: "Numeric target" },
};

export default function Criteria() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: criteria, isLoading } = useListCriteria({ request: { headers: authHeader() } });
  const createMutation = useCreateCriterion({ request: { headers: authHeader() } });
  const updateMutation = useUpdateCriterion({ request: { headers: authHeader() } });
  const deleteMutation = useDeleteCriterion({ request: { headers: authHeader() } });

  const [activeTab, setActiveTab] = useState<"criteria" | "groups">("criteria");

  // ── Criterion form ──────────────────────────────────────────────────
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "", description: "", category: "Core", weight: 10,
    type: "rating" as CriteriaType, targetValue: "", unit: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      name: formData.name,
      description: formData.description,
      category: formData.category,
      weight: Number(formData.weight),
      type: formData.type,
      targetValue: formData.type !== "rating" && formData.targetValue ? Number(formData.targetValue) : null,
      unit: formData.type !== "rating" && formData.unit ? formData.unit : null,
    };
    const cb = { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/criteria"] }); setIsDialogOpen(false); } };
    if (editingId) updateMutation.mutate({ id: editingId, data: payload }, cb);
    else createMutation.mutate({ data: payload }, cb);
  };

  const openEdit = (crit: any) => {
    setFormData({
      name: crit.name, description: crit.description || "", category: crit.category, weight: crit.weight,
      type: (crit.type ?? "rating") as CriteriaType,
      targetValue: crit.targetValue ?? crit.target_value ?? "",
      unit: crit.unit ?? "",
    });
    setEditingId(crit.id);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this criterion? It will also be removed from any groups."))
      deleteMutation.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/criteria"] }) });
  };

  // ── Criteria Groups ─────────────────────────────────────────────────
  const [groups, setGroups] = useState<CriteriaGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [groupForm, setGroupForm] = useState({ name: "", description: "", criteriaIds: [] as number[] });
  const [expandedGroupId, setExpandedGroupId] = useState<number | null>(null);

  const loadGroups = async () => {
    setGroupsLoading(true);
    try {
      const r = await apiFetch("/api/criteria-groups");
      const data = await r.json();
      setGroups(data);
    } finally {
      setGroupsLoading(false);
    }
  };

  useEffect(() => { if (activeTab === "groups") loadGroups(); }, [activeTab]);

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingGroupId ? `/api/criteria-groups/${editingGroupId}` : "/api/criteria-groups";
    await apiFetch(url, {
      method: editingGroupId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(groupForm),
    });
    setIsGroupDialogOpen(false);
    loadGroups();
  };

  const handleGroupDelete = async (id: number) => {
    if (!confirm("Delete this criteria group?")) return;
    await apiFetch(`/api/criteria-groups/${id}`, { method: "DELETE" });
    loadGroups();
  };

  const openGroupEdit = (g: CriteriaGroup) => {
    setGroupForm({
      name: g.name, description: g.description || "",
      criteriaIds: g.criteria.map((c: any) => c.id),
    });
    setEditingGroupId(g.id);
    setIsGroupDialogOpen(true);
  };

  const toggleCriterionInGroup = (id: number) =>
    setGroupForm(prev => ({
      ...prev,
      criteriaIds: prev.criteriaIds.includes(id)
        ? prev.criteriaIds.filter(c => c !== id)
        : [...prev.criteriaIds, id],
    }));

  if (isLoading) return <div className="p-8">Loading criteria...</div>;
  if (user?.role !== "admin" && user?.role !== "super_admin") return <div className="p-8 text-destructive">Unauthorized</div>;

  const grouped = criteria?.reduce((acc, curr) => {
    (acc[curr.category] = acc[curr.category] || []).push(curr);
    return acc;
  }, {} as Record<string, typeof criteria>);

  return (
    <div>
      <PageHeader title="Evaluation Criteria" description="Configure the competencies and metrics used in appraisals.">
        <Button onClick={() => {
          if (activeTab === "criteria") {
            setFormData({ name: "", description: "", category: "Core", weight: 10, type: "rating", targetValue: "", unit: "" });
            setEditingId(null);
            setIsDialogOpen(true);
          } else {
            setGroupForm({ name: "", description: "", criteriaIds: [] });
            setEditingGroupId(null);
            setIsGroupDialogOpen(true);
          }
        }}>
          <Plus className="w-4 h-4 mr-2" /> {activeTab === "criteria" ? "Add Criterion" : "New Group"}
        </Button>
      </PageHeader>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-muted p-1 rounded-xl w-fit">
        {(["criteria", "groups"] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${activeTab === t ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t === "criteria" ? <><ListChecks className="w-4 h-4 inline mr-1.5 -mt-0.5" />Criteria</> : <><Layers className="w-4 h-4 inline mr-1.5 -mt-0.5" />Groups</>}
          </button>
        ))}
      </div>

      {/* ── CRITERIA TAB ── */}
      {activeTab === "criteria" && (
        <>
          {!criteria?.length ? (
            <EmptyState title="No criteria defined" description="Add evaluation metrics to build the appraisal rubrics." icon={ListChecks} />
          ) : (
            <div className="space-y-8">
              {Object.entries(grouped || {}).map(([category, items]) => (
                <div key={category} className="space-y-4">
                  <h3 className="text-lg font-bold font-display flex items-center gap-2">
                    <div className="w-2 h-6 bg-primary rounded-full" />
                    {category} Competencies
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map(crit => {
                      const typeInfo = TYPE_LABELS[(crit.type as CriteriaType) ?? "rating"];
                      return (
                        <Card key={crit.id} className="p-5 flex flex-col group">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-foreground">{crit.name}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEdit(crit)} className="text-muted-foreground hover:text-primary"><Edit2 className="w-4 h-4" /></button>
                              <button onClick={() => handleDelete(crit.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground flex-1 mb-3">{crit.description}</p>
                          <div className="flex flex-wrap gap-2">
                            <span className="bg-muted px-2.5 py-1 rounded-lg text-xs font-medium">Weight: {crit.weight}%</span>
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${typeInfo.color}`}>
                              {typeInfo.label}
                            </span>
                            {(crit.type === "percentage" || crit.type === "value") && (crit.targetValue ?? crit.target_value) && (
                              <span className="bg-muted px-2.5 py-1 rounded-lg text-xs font-medium">
                                Target: {crit.targetValue ?? crit.target_value}{crit.unit ? ` ${crit.unit}` : ""}
                              </span>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── GROUPS TAB ── */}
      {activeTab === "groups" && (
        <>
          {groupsLoading ? (
            <div className="p-8 text-muted-foreground">Loading groups...</div>
          ) : groups.length === 0 ? (
            <EmptyState title="No criteria groups" description="Create groups to bundle criteria together and assign them to appraisals." icon={Layers} />
          ) : (
            <div className="space-y-3">
              {groups.map(g => (
                <Card key={g.id} className="overflow-hidden">
                  <div
                    className="flex items-center justify-between p-5 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedGroupId(expandedGroupId === g.id ? null : g.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Layers className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{g.name}</p>
                        <p className="text-sm text-muted-foreground">{g.criteria.length} criteria{g.description ? ` · ${g.description}` : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={e => { e.stopPropagation(); openGroupEdit(g); }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary"
                      ><Edit2 className="w-4 h-4" /></button>
                      <button
                        onClick={e => { e.stopPropagation(); handleGroupDelete(g.id); }}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      ><Trash2 className="w-4 h-4" /></button>
                      <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expandedGroupId === g.id ? "rotate-90" : ""}`} />
                    </div>
                  </div>
                  {expandedGroupId === g.id && g.criteria.length > 0 && (
                    <div className="border-t border-border bg-muted/20 px-5 py-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {g.criteria.map((c: any) => {
                          const typeInfo = TYPE_LABELS[(c.type as CriteriaType) ?? "rating"];
                          return (
                            <div key={c.id} className="bg-card rounded-lg p-3 border border-border">
                              <p className="font-medium text-sm">{c.name}</p>
                              <div className="flex gap-2 mt-2 flex-wrap">
                                <span className="text-xs text-muted-foreground">{c.category}</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${typeInfo.color}`}>{typeInfo.label}</span>
                                {(c.type === "percentage" || c.type === "value") && (c.targetValue ?? c.target_value) && (
                                  <span className="text-xs text-muted-foreground">Target: {c.targetValue ?? c.target_value}{c.unit ? ` ${c.unit}` : ""}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Criterion Dialog ── */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">{editingId ? "Edit" : "Create"} Criterion</h2>
              <button onClick={() => setIsDialogOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label>Name</Label><Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required /></div>
              <div><Label>Category</Label><Input value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} required placeholder="e.g. Core, Leadership, Technical" /></div>
              <div><Label>Description</Label><textarea className="w-full border rounded-xl px-4 py-2 min-h-[72px] text-sm" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div>
              <div><Label>Weight (%)</Label><Input type="number" value={formData.weight} onChange={e => setFormData({ ...formData, weight: parseInt(e.target.value) })} required min="1" max="100" /></div>
              
              {/* Type selector */}
              <div>
                <Label>Criteria Type</Label>
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  {(["rating", "percentage", "value"] as CriteriaType[]).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormData({ ...formData, type: t })}
                      className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left ${formData.type === t ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted/40"}`}
                    >
                      <p className="font-semibold capitalize">{t}</p>
                      <p className="text-xs opacity-70 mt-0.5">{TYPE_LABELS[t].desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Target value & unit — only for non-rating */}
              {formData.type !== "rating" && (
                <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-xl">
                  <div>
                    <Label>{formData.type === "percentage" ? "Target (%)" : "Target Value"}</Label>
                    <Input
                      type="number" step="0.01" min="0"
                      value={formData.targetValue}
                      onChange={e => setFormData({ ...formData, targetValue: e.target.value })}
                      placeholder={formData.type === "percentage" ? "e.g. 100" : "e.g. 500000"}
                      required
                    />
                  </div>
                  <div>
                    <Label>Unit <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input
                      value={formData.unit}
                      onChange={e => setFormData({ ...formData, unit: e.target.value })}
                      placeholder={formData.type === "percentage" ? "%" : "$"}
                    />
                  </div>
                </div>
              )}

              <Button className="w-full mt-4" type="submit" isLoading={createMutation.isPending || updateMutation.isPending}>Save</Button>
            </form>
          </Card>
        </div>
      )}

      {/* ── Group Dialog ── */}
      {isGroupDialogOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">{editingGroupId ? "Edit" : "Create"} Criteria Group</h2>
              <button onClick={() => setIsGroupDialogOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleGroupSubmit} className="space-y-4">
              <div><Label>Group Name</Label><Input value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} required placeholder="e.g. Sales Team Criteria" /></div>
              <div><Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label><Input value={groupForm.description} onChange={e => setGroupForm({ ...groupForm, description: e.target.value })} /></div>
              <div>
                <Label>Select Criteria</Label>
                <p className="text-xs text-muted-foreground mb-2">Choose which criteria belong to this group.</p>
                <div className="max-h-60 overflow-y-auto border border-border rounded-xl divide-y divide-border">
                  {criteria?.length ? criteria.map(c => {
                    const checked = groupForm.criteriaIds.includes(c.id);
                    const typeInfo = TYPE_LABELS[(c.type as CriteriaType) ?? "rating"];
                    return (
                      <label key={c.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors ${checked ? "bg-primary/5" : ""}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleCriterionInGroup(c.id)} className="accent-primary" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.category}</p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${typeInfo.color}`}>{typeInfo.label}</span>
                      </label>
                    );
                  }) : <div className="p-4 text-sm text-muted-foreground">No criteria yet.</div>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{groupForm.criteriaIds.length} selected</p>
              </div>
              <Button className="w-full mt-4" type="submit">Save Group</Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
