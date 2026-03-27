import { useState, useEffect } from "react";
import { PageHeader, Card, Button, Input, Label } from "@/components/shared";
import { Building2, Plus, Edit, Trash2, X, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

type Department = { id: number; name: string; description: string | null; employeeCount: number };

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" });

export default function Departments() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const fetchDepartments = () => {
    setLoading(true);
    fetch("/api/departments", { headers: authHeader() })
      .then(r => r.json())
      .then(data => { setDepartments(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setError("Failed to load departments."); setLoading(false); });
  };

  useEffect(() => { fetchDepartments(); }, []);

  const openCreate = () => {
    setFormData({ name: "", description: "" });
    setFormError(null);
    setEditingId(null);
    setIsDialogOpen(true);
  };

  const openEdit = (d: Department) => {
    setFormData({ name: d.name, description: d.description ?? "" });
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
      const r = await fetch(url, {
        method,
        headers: authHeader(),
        body: JSON.stringify({ name: formData.name.trim(), description: formData.description.trim() || null }),
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
      const r = await fetch(`/api/departments/${d.id}`, { method: "DELETE", headers: authHeader() });
      if (r.ok) fetchDepartments();
    } catch {}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map(d => (
            <Card key={d.id} className="p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{d.name}</p>
                    {d.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{d.description}</p>}
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
