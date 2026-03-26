import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, Card, Button, Input, Label, EmptyState } from "@/components/shared";
import { Shield, Plus, Edit, Trash2, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const PERMISSION_LEVELS = [
  { value: "employee", label: "Employee", desc: "Can complete self-reviews and view own appraisals", color: "bg-slate-100 text-slate-700" },
  { value: "manager",  label: "Manager",  desc: "Can review team appraisals and manage team members", color: "bg-blue-100 text-blue-700" },
  { value: "admin",    label: "Admin",    desc: "Full access including approvals and user management", color: "bg-purple-100 text-purple-700" },
];

const API = (path: string) => `/api${path}`;
const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}`, "Content-Type": "application/json" });

type CustomRole = { id: number; name: string; permissionLevel: string; description: string | null; createdAt: string };

export default function Roles() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({ name: "", permissionLevel: "employee", description: "" });

  // Load roles on mount
  useEffect(() => {
    fetch(API("/custom-roles"), { headers: authHeader() })
      .then(r => r.json())
      .then(data => { setRoles(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const refreshRoles = () => {
    fetch(API("/custom-roles"), { headers: authHeader() })
      .then(r => r.json())
      .then(setRoles);
  };

  const openCreate = () => {
    setFormData({ name: "", permissionLevel: "employee", description: "" });
    setEditingId(null);
    setError("");
    setIsDialogOpen(true);
  };

  const openEdit = (r: CustomRole) => {
    setFormData({ name: r.name, permissionLevel: r.permissionLevel, description: r.description ?? "" });
    setEditingId(r.id);
    setError("");
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const method = editingId ? "PUT" : "POST";
      const url = editingId ? API(`/custom-roles/${editingId}`) : API("/custom-roles");
      const res = await fetch(url, { method, headers: authHeader(), body: JSON.stringify(formData) });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        return;
      }
      refreshRoles();
      queryClient.invalidateQueries({ queryKey: ["/api/custom-roles"] });
      setIsDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this role? Users assigned to it will be unaffected in terms of access, but their role label will be cleared.")) return;
    await fetch(API(`/custom-roles/${id}`), { method: "DELETE", headers: authHeader() });
    refreshRoles();
  };

  if (user?.role !== "admin" && user?.role !== "super_admin") return <div className="p-8 text-destructive">Unauthorized</div>;
  if (loading) return <div className="p-8 animate-pulse text-muted-foreground">Loading roles...</div>;

  return (
    <div>
      <PageHeader title="Role Management" description="Create custom roles and assign permission levels to them.">
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Create Role
        </Button>
      </PageHeader>

      {/* Permission levels legend */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {PERMISSION_LEVELS.map(pl => (
          <Card key={pl.value} className="p-4 flex gap-3 items-start">
            <span className={`text-xs font-bold px-2 py-1 rounded capitalize mt-0.5 ${pl.color}`}>{pl.label}</span>
            <p className="text-sm text-muted-foreground">{pl.desc}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        {roles.length === 0 ? (
          <EmptyState
            title="No custom roles yet"
            description="Create roles like 'Senior Manager' or 'Team Lead' to give users more specific titles."
            icon={Shield}
          />
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b text-sm text-muted-foreground">
                <th className="p-4">Role Name</th>
                <th className="p-4">Permission Level</th>
                <th className="p-4 hidden md:table-cell">Description</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {roles.map(r => {
                const pl = PERMISSION_LEVELS.find(p => p.value === r.permissionLevel);
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="p-4 font-semibold">{r.name}</td>
                    <td className="p-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded capitalize ${pl?.color ?? 'bg-slate-100 text-slate-700'}`}>
                        {r.permissionLevel}
                      </span>
                    </td>
                    <td className="p-4 hidden md:table-cell text-sm text-muted-foreground">{r.description || '—'}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEdit(r)}>
                          <Edit className="w-3.5 h-3.5" /> Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(r.id)}>
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">{editingId ? "Edit Role" : "Create Role"}</h2>
              <button onClick={() => setIsDialogOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Role Name</Label>
                <Input
                  placeholder="e.g. Senior Manager, Team Lead, VP of Engineering"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Permission Level</Label>
                <p className="text-xs text-muted-foreground mb-2">This controls what the user can access in the system.</p>
                <div className="space-y-2">
                  {PERMISSION_LEVELS.map(pl => (
                    <label key={pl.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${formData.permissionLevel === pl.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}>
                      <input
                        type="radio"
                        name="permissionLevel"
                        value={pl.value}
                        checked={formData.permissionLevel === pl.value}
                        onChange={() => setFormData({ ...formData, permissionLevel: pl.value })}
                        className="mt-0.5 accent-primary"
                      />
                      <div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded capitalize ${pl.color}`}>{pl.label}</span>
                        <p className="text-xs text-muted-foreground mt-1">{pl.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  placeholder="Brief description of this role"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full mt-2" type="submit" isLoading={saving}>Save Role</Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
