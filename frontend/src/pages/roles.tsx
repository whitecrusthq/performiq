import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, Card, Button, Input, Label, EmptyState } from "@/components/shared";
import { Shield, Plus, Edit, Trash2, X, LayoutDashboard, ClipboardList, Target, RefreshCcw, ListChecks, Users, BarChart3, Building2, MapPin, CalendarDays, Clock, ClipboardCheck, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/utils";

const PERMISSION_LEVELS = [
  { value: "employee", label: "Employee", desc: "Can complete self-reviews and view own appraisals", color: "bg-slate-100 text-slate-700" },
  { value: "manager",  label: "Manager",  desc: "Can review team appraisals and manage team members", color: "bg-blue-100 text-blue-700" },
  { value: "admin",    label: "Admin",    desc: "Full access including approvals and user management", color: "bg-purple-100 text-purple-700" },
];

const ALL_MENUS = [
  { key: "dashboard",   label: "Dashboard",   icon: LayoutDashboard },
  { key: "appraisals",  label: "Appraisals",  icon: ClipboardList },
  { key: "goals",       label: "Goals",       icon: Target },
  { key: "cycles",      label: "Cycles",      icon: RefreshCcw },
  { key: "criteria",    label: "Criteria",    icon: ListChecks },
  { key: "leave",       label: "Leave",       icon: CalendarDays },
  { key: "attendance",  label: "Attendance",  icon: Clock },
  { key: "timesheets",  label: "Timesheets",  icon: ClipboardCheck },
  { key: "reports",     label: "Reports",     icon: BarChart3 },
  { key: "users",       label: "Users",       icon: Users },
  { key: "departments", label: "Departments", icon: Building2 },
  { key: "sites",       label: "Sites",       icon: MapPin },
  { key: "roles",       label: "Roles",       icon: Shield },
  { key: "onboarding",  label: "Onboarding",  icon: UserPlus },
];

type CustomRole = { id: number; name: string; permissionLevel: string; description: string | null; menuPermissions: string[]; createdAt: string };

const emptyForm = () => ({ name: "", permissionLevel: "employee", description: "", menuPermissions: [] as string[] });

export default function Roles() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState(emptyForm());

  useEffect(() => {
    apiFetch("/api/custom-roles")
      .then(r => r.json())
      .then(data => { setRoles(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const refreshRoles = () => {
    apiFetch("/api/custom-roles")
      .then(r => r.json())
      .then(setRoles);
  };

  const openCreate = () => {
    setFormData(emptyForm());
    setEditingId(null);
    setError("");
    setIsDialogOpen(true);
  };

  const openEdit = (r: CustomRole) => {
    setFormData({ name: r.name, permissionLevel: r.permissionLevel, description: r.description ?? "", menuPermissions: r.menuPermissions ?? [] });
    setEditingId(r.id);
    setError("");
    setIsDialogOpen(true);
  };

  const toggleMenu = (key: string) => {
    setFormData(fd => ({
      ...fd,
      menuPermissions: fd.menuPermissions.includes(key)
        ? fd.menuPermissions.filter(k => k !== key)
        : [...fd.menuPermissions, key],
    }));
  };

  const selectAllMenus = () => setFormData(fd => ({ ...fd, menuPermissions: ALL_MENUS.map(m => m.key) }));
  const clearAllMenus = () => setFormData(fd => ({ ...fd, menuPermissions: [] }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const method = editingId ? "PUT" : "POST";
      const url = editingId ? `/api/custom-roles/${editingId}` : "/api/custom-roles";
      const res = await apiFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
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
    if (!confirm("Delete this role? Users assigned to it will lose their custom role label.")) return;
    await apiFetch(`/api/custom-roles/${id}`, { method: "DELETE" });
    refreshRoles();
  };

  if (user?.role !== "admin" && user?.role !== "super_admin") return <div className="p-8 text-destructive">Unauthorized</div>;
  if (loading) return <div className="p-8 animate-pulse text-muted-foreground">Loading roles...</div>;

  return (
    <div>
      <PageHeader title="Role Management" description="Create custom roles with specific menu access permissions.">
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
            description="Create roles like 'HR Manager' or 'Finance Admin' and control exactly which menus they can access."
            icon={Shield}
          />
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b text-sm text-muted-foreground">
                <th className="p-4">Role Name</th>
                <th className="p-4">Permission Level</th>
                <th className="p-4 hidden md:table-cell">Menu Access</th>
                <th className="p-4 hidden lg:table-cell">Description</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {roles.map(r => {
                const pl = PERMISSION_LEVELS.find(p => p.value === r.permissionLevel);
                const menuCount = r.menuPermissions?.length ?? 0;
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="p-4 font-semibold">{r.name}</td>
                    <td className="p-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded capitalize ${pl?.color ?? 'bg-slate-100 text-slate-700'}`}>
                        {r.permissionLevel}
                      </span>
                    </td>
                    <td className="p-4 hidden md:table-cell text-sm">
                      {menuCount === 0 ? (
                        <span className="text-muted-foreground italic">All menus (default)</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {r.menuPermissions.slice(0, 4).map(k => {
                            const m = ALL_MENUS.find(m => m.key === k);
                            return m ? <span key={k} className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">{m.label}</span> : null;
                          })}
                          {menuCount > 4 && <span className="px-1.5 py-0.5 bg-muted rounded text-xs text-muted-foreground">+{menuCount - 4} more</span>}
                        </div>
                      )}
                    </td>
                    <td className="p-4 hidden lg:table-cell text-sm text-muted-foreground">{r.description || '—'}</td>
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <Card className="w-full max-w-lg p-6 shadow-2xl my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">{editingId ? "Edit Role" : "Create Role"}</h2>
              <button onClick={() => setIsDialogOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label>Role Name</Label>
                <Input
                  placeholder="e.g. HR Manager, Finance Admin, Team Lead"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label>Permission Level</Label>
                <p className="text-xs text-muted-foreground mb-2">Base system permissions this role inherits.</p>
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
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <Label>Menu Access</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Select which menus this role can see. Leave all unchecked to inherit default access.</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="text-xs text-primary underline" onClick={selectAllMenus}>All</button>
                    <span className="text-xs text-muted-foreground">·</span>
                    <button type="button" className="text-xs text-muted-foreground underline" onClick={clearAllMenus}>None</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 p-3 border rounded-xl bg-muted/20">
                  {ALL_MENUS.map(m => {
                    const checked = formData.menuPermissions.includes(m.key);
                    return (
                      <label key={m.key} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${checked ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-foreground'}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMenu(m.key)}
                          className="accent-primary"
                        />
                        <m.icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-xs font-medium">{m.label}</span>
                      </label>
                    );
                  })}
                </div>
                {formData.menuPermissions.length > 0 && (
                  <p className="text-xs text-primary mt-1.5 font-medium">{formData.menuPermissions.length} of {ALL_MENUS.length} menus selected</p>
                )}
                {formData.menuPermissions.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1.5">No menus selected — user will see all menus allowed by their permission level.</p>
                )}
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
