import { useState, useEffect } from "react";
import { PageHeader, Card, Button, Input, Label } from "@/components/shared";
import { Building2, Plus, Edit, Trash2, X, Users, Search } from "lucide-react";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/utils";

type Department = { id: number; name: string; description: string | null; employeeCount: number; shiftType: string | null; clockOutSlot: string | null };

export default function Departments() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "", shiftType: "", clockOutSlot: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [daySlots, setDaySlots] = useState<string[]>([]);
  const [nightSlots, setNightSlots] = useState<string[]>([]);

  useEffect(() => {
    apiFetch("/api/attendance/schedule-settings")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.settings) { setDaySlots(d.settings.daySweepTimes ?? []); setNightSlots(d.settings.nightSweepTimes ?? []); } })
      .catch(() => {});
  }, []);

  const slotOptions = formData.shiftType === "night" ? nightSlots : daySlots;

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const fetchDepartments = () => {
    setLoading(true);
    apiFetch("/api/departments")
      .then(r => r.json())
      .then(data => { setDepartments(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setError("Failed to load departments."); setLoading(false); });
  };

  useEffect(() => { fetchDepartments(); }, []);

  const openCreate = () => {
    setFormData({ name: "", description: "", shiftType: "", clockOutSlot: "" });
    setFormError(null);
    setEditingId(null);
    setIsDialogOpen(true);
  };

  const openEdit = (d: Department) => {
    setFormData({ name: d.name, description: d.description ?? "", shiftType: d.shiftType ?? "", clockOutSlot: d.clockOutSlot ?? "" });
    setFormError(null);
    setEditingId(d.id);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { setFormError("Department name is required."); return; }
    setSaving(true);
    setFormError(null);

    const url = editingId ? `/api/departments/${editingId}` : "/api/departments";
    const method = editingId ? "PUT" : "POST";

    try {
      const r = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          shiftType: formData.shiftType || null,
          clockOutSlot: formData.shiftType ? (formData.clockOutSlot || null) : null,
        }),
      });
      const data = await r.json();
      if (!r.ok) { setFormError(data.error || "Save failed."); return; }
      setIsDialogOpen(false);
      fetchDepartments();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (d: Department) => {
    if (!confirm(`Delete "${d.name}"? This won't affect users already assigned to it.`)) return;
    try {
      const r = await apiFetch(`/api/departments/${d.id}`, { method: "DELETE" });
      if (r.ok) fetchDepartments();
    } catch {}
  };

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [search, setSearch] = useState("");

  const filteredDepartments = departments.filter(d => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return d.name.toLowerCase().includes(q) || (d.description ?? "").toLowerCase().includes(q);
  });

  const toggleSelect = (id: number) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (selectedIds.size === filteredDepartments.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredDepartments.map(d => d.id)));
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} selected department(s)? This won't affect users already assigned to them.`)) return;
    setBulkDeleting(true);
    await Promise.all([...selectedIds].map(id => apiFetch(`/api/departments/${id}`, { method: "DELETE" })));
    fetchDepartments();
    setSelectedIds(new Set());
    setBulkDeleting(false);
  };

  if (!isAdmin) return <div className="p-8 text-destructive">Unauthorized</div>;

  return (
    <div>
      <PageHeader title="Departments" description="Manage your organisation's departments.">
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Add Department
        </Button>
      </PageHeader>

      {loading && <div className="flex items-center justify-center h-48 text-muted-foreground">Loading…</div>}
      {error && <div className="text-destructive p-4">{error}</div>}

      {!loading && !error && departments.length === 0 && (
        <Card className="p-12 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <p className="text-lg font-semibold text-foreground mb-1">No departments yet</p>
          <p className="text-muted-foreground text-sm mb-6">Create your first department to organise employees and reports.</p>
          <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Add Department</Button>
        </Card>
      )}

      {!loading && departments.length > 0 && (
        <>
          <div className="mb-4 relative max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search departments by name or description…"
              className="w-full pl-9 pr-9 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:bg-muted">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <BulkActionBar count={selectedIds.size} onDelete={handleBulkDelete} onClear={() => setSelectedIds(new Set())} deleting={bulkDeleting} />
          {filteredDepartments.length === 0 ? (
            <Card className="p-12 text-center">
              <Search className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground font-medium">No departments match "{search}"</p>
              <button onClick={() => setSearch("")} className="text-sm text-primary hover:underline mt-2">Clear search</button>
            </Card>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDepartments.map(d => (
              <Card key={d.id} className={`p-5 flex flex-col gap-3 ${selectedIds.has(d.id) ? "ring-2 ring-primary/30" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(d.id)}
                      onChange={() => toggleSelect(d.id)}
                      className="mt-1 w-4 h-4 accent-primary cursor-pointer shrink-0"
                    />
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{d.name}</p>
                        {d.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{d.description}</p>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(d)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(d)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-sm text-muted-foreground border-t border-border pt-3 mt-auto">
                <Users className="w-3.5 h-3.5" />
                <span>{d.employeeCount} {d.employeeCount === 1 ? "employee" : "employees"}</span>
              </div>
            </Card>
          ))}
          </div>
          )}
        </>
      )}

      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center p-6 pb-4">
              <h2 className="text-xl font-bold">{editingId ? "Edit Department" : "New Department"}</h2>
              <button onClick={() => setIsDialogOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
              <div>
                <Label>Department Name <span className="text-destructive">*</span></Label>
                <Input
                  autoFocus
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Engineering, Marketing, HR"
                />
              </div>
              <div>
                <Label>Description <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-2 border border-border rounded-xl bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this department's function"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Shift type</Label>
                  <select
                    className="w-full px-3 py-2 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={formData.shiftType}
                    onChange={e => setFormData({ ...formData, shiftType: e.target.value, clockOutSlot: "" })}
                  >
                    <option value="">No auto clock-out</option>
                    <option value="day">Day shift</option>
                    <option value="night">Night shift (crosses midnight)</option>
                  </select>
                </div>
                <div>
                  <Label>Auto clock-out time</Label>
                  <select
                    className="w-full px-3 py-2 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                    value={formData.clockOutSlot}
                    disabled={!formData.shiftType}
                    onChange={e => setFormData({ ...formData, clockOutSlot: e.target.value })}
                  >
                    <option value="">Select time…</option>
                    {slotOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground -mt-1">
                Employees in this department who forget to clock out are automatically clocked out at this time. Night shift resolves to the next morning. Per-user overrides take precedence.
              </p>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <Button className="w-full" type="submit" isLoading={saving}>
                {editingId ? "Save Changes" : "Create Department"}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
