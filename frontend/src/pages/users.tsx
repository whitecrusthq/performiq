import { useState, useEffect, useMemo } from "react";
import { useListUsers, useCreateUser, useUpdateUser, useDeleteUser } from "../lib";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, Card, Button, Input, Label } from "@/components/shared";
import { Users as UsersIcon, Plus, Edit, Trash2, X, Search, ChevronDown, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/utils";

interface Site { id: number; name: string; city?: string | null; country?: string | null; }

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}`, "Content-Type": "application/json" });

const NEW_DEPT_SENTINEL = "__new__";

export default function Users() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
  
  const { data: users, isLoading } = useListUsers({ request: { headers } });
  
  const createMutation = useCreateUser({ request: { headers } });
  const updateMutation = useUpdateUser({ request: { headers } });
  const deleteMutation = useDeleteUser({ request: { headers } });

  const [customRoles, setCustomRoles] = useState<{ id: number; name: string; permissionLevel: string }[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "", password: "", role: "employee" as any, customRoleId: "", siteId: "", department: "", jobTitle: "", phone: "", staffId: "" });
  const [isNewDept, setIsNewDept] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterDept, setFilterDept] = useState("");

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users.filter(u => {
      const q = search.toLowerCase();
      const matchSearch = !q || (u.name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
      const matchRole = !filterRole || u.role === filterRole;
      const matchDept = !filterDept || (u.department ?? "") === filterDept;
      return matchSearch && matchRole && matchDept;
    });
  }, [users, search, filterRole, filterDept]);

  useEffect(() => {
    apiFetch("/api/custom-roles", { headers: authHeader() })
      .then(r => r.json())
      .then(data => Array.isArray(data) && setCustomRoles(data))
      .catch(() => {});
    apiFetch("/api/departments", { headers: authHeader() })
      .then(r => r.json())
      .then(data => Array.isArray(data) && setDepartments(data.map((d: any) => d.name ?? d)))
      .catch(() => {});
    apiFetch("/api/sites", { headers: authHeader() })
      .then(r => r.json())
      .then(data => Array.isArray(data) && setSites(data))
      .catch(() => {});
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMutationError(null);
    const base = {
      name: formData.name,
      email: formData.email,
      role: formData.role,
      customRoleId: formData.customRoleId ? parseInt(formData.customRoleId) : null,
      siteId: formData.siteId ? parseInt(formData.siteId) : null,
      department: formData.department || null,
      jobTitle: formData.jobTitle || null,
      phone: formData.phone || null,
      staffId: formData.staffId || null,
    };
    if (editingId) {
      const updateData = formData.password.trim() !== "" ? { ...base, password: formData.password } : base;
      updateMutation.mutate({ id: editingId, data: updateData }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/users"] }); setIsDialogOpen(false); setMutationError(null); },
        onError: (err: any) => { setMutationError(err?.data?.error ?? err?.message ?? "Failed to update user. Please try again."); }
      });
    } else {
      createMutation.mutate({ data: { ...base, password: formData.password } }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/users"] }); setIsDialogOpen(false); setMutationError(null); },
        onError: (err: any) => { setMutationError(err?.data?.error ?? err?.message ?? "Failed to create user. Please try again."); }
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete user?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/users"] }),
        onError: (err: any) => alert(err?.data?.error ?? err?.message ?? "Failed to delete user.")
      });
    }
  };

  if (isLoading) return <div className="p-8">Loading users...</div>;
  if (user?.role !== 'admin' && user?.role !== 'super_admin') return <div className="p-8 text-destructive">Unauthorized</div>;

  return (
    <div>
      <PageHeader title="User Management" description="Manage platform access and organizational structure.">
        <Button onClick={() => { setMutationError(null); setFormData({ name: "", email: "", password: "", role: "employee", customRoleId: "", siteId: "", department: "", jobTitle: "", phone: "", staffId: "" }); setEditingId(null); setIsNewDept(false); setIsDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add User
        </Button>
      </PageHeader>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Search name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <select
            className="pl-3 pr-8 py-2 rounded-xl border border-border bg-card text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
          >
            <option value="">All Roles</option>
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>
        <div className="relative">
          <select
            className="pl-3 pr-8 py-2 rounded-xl border border-border bg-card text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={filterDept}
            onChange={e => setFilterDept(e.target.value)}
          >
            <option value="">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>
        {(search || filterRole || filterDept) && (
          <button
            className="px-3 py-2 text-xs text-muted-foreground underline hover:text-foreground"
            onClick={() => { setSearch(""); setFilterRole(""); setFilterDept(""); }}
          >
            Clear filters
          </button>
        )}
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b text-sm text-muted-foreground">
              <th className="p-4">Name</th>
              <th className="p-4 hidden sm:table-cell">Role</th>
              <th className="p-4 hidden md:table-cell">Department / Title</th>
              <th className="p-4 hidden lg:table-cell">Phone / Staff ID</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredUsers.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground text-sm">No users match the current filters.</td></tr>
            )}
            {filteredUsers.map(u => (
              <tr key={u.id} className="hover:bg-muted/30">
                <td className="p-4">
                  <div className="font-semibold text-foreground">{u.name}</div>
                  <div className="text-sm text-muted-foreground">{u.email}</div>
                </td>
                <td className="p-4 hidden sm:table-cell">
                  <div className="flex flex-col gap-1">
                    {u.customRole ? (
                      <span className="font-medium text-sm">{u.customRole.name}</span>
                    ) : null}
                    <span className={`px-2 py-0.5 rounded text-xs font-medium w-fit capitalize ${u.role==='super_admin'?'bg-violet-100 text-violet-700':u.role==='admin'?'bg-purple-100 text-purple-700':u.role==='manager'?'bg-blue-100 text-blue-700':'bg-slate-100 text-slate-700'}`}>{u.role === 'super_admin' ? 'Super Admin' : u.role}</span>
                  </div>
                </td>
                <td className="p-4 hidden md:table-cell text-sm">
                  {u.department && <div>{u.department}</div>}
                  {u.jobTitle && <div className="text-muted-foreground">{u.jobTitle}</div>}
                </td>
                <td className="p-4 hidden lg:table-cell text-sm">
                  {u.phone && <div>{u.phone}</div>}
                  {u.staffId && <div className="text-muted-foreground font-mono text-xs">{u.staffId}</div>}
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => { setMutationError(null); setFormData({ name: u.name, email: u.email, password: "", role: u.role, customRoleId: u.customRole?.id?.toString() || "", siteId: (u as any).siteId?.toString() || "", department: u.department||"", jobTitle: u.jobTitle||"", phone: u.phone||"", staffId: u.staffId||"" }); setEditingId(u.id); setIsNewDept(false); setIsDialogOpen(true); }}
                    >
                      <Edit className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleDelete(u.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 pb-4 shrink-0">
              <h2 className="text-xl font-bold">{editingId ? "Edit User" : "Create User"}</h2>
              <button onClick={() => setIsDialogOpen(false)}><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto px-6 pb-6">
              <div><Label>Name</Label><Input value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} required /></div>
              <div><Label>Email</Label><Input type="email" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} required /></div>
              <div>
                <Label>{editingId ? "New Password" : "Password"}</Label>
                <Input type="password" placeholder={editingId ? "Leave blank to keep unchanged" : ""} value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})} required={!editingId} />
              </div>
              <div>
                <Label>Site <span className="text-destructive">*</span></Label>
                {sites.length === 0 ? (
                  <p className="text-sm text-amber-600 mt-1">No sites available. <a href="/sites" className="underline">Create a site</a> first.</p>
                ) : (
                  <select
                    className="w-full px-4 py-2 border rounded-xl bg-background text-sm"
                    value={formData.siteId}
                    onChange={e => setFormData({ ...formData, siteId: e.target.value })}
                    required
                  >
                    <option value="">— Select site —</option>
                    {sites.map(s => (
                      <option key={s.id} value={s.id}>{s.name}{s.city ? ` (${s.city})` : ""}</option>
                    ))}
                  </select>
                )}
              </div>
              {customRoles.length > 0 && (
                <div>
                  <Label>Custom Role <span className="text-muted-foreground font-normal text-xs">(optional — sets permission level automatically)</span></Label>
                  <select
                    className="w-full px-4 py-2 border rounded-xl bg-background"
                    value={formData.customRoleId}
                    onChange={e => {
                      const selected = customRoles.find(r => r.id === parseInt(e.target.value));
                      setFormData({ ...formData, customRoleId: e.target.value, role: selected ? selected.permissionLevel as any : formData.role });
                    }}
                  >
                    <option value="">— No custom role —</option>
                    {customRoles.map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.permissionLevel})</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <Label>Permission Level</Label>
                <select className="w-full px-4 py-2 border rounded-xl bg-background" value={formData.role} onChange={e=>setFormData({...formData, role: e.target.value as any, customRoleId: ""})}>
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  {(user?.role === "admin" || user?.role === "super_admin") && <option value="admin">Admin</option>}
                  {user?.role === "super_admin" && <option value="super_admin">Super Admin</option>}
                </select>
                {(formData.role === "admin" || formData.role === "super_admin") && user?.role !== "super_admin" && (
                  <p className="text-xs text-amber-600 mt-1">Only a Super Admin can assign admin-level roles.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Department</Label>
                  {!isNewDept ? (
                    <select
                      className="w-full px-4 py-2 border rounded-xl bg-background text-sm"
                      value={formData.department}
                      onChange={e => {
                        if (e.target.value === NEW_DEPT_SENTINEL) {
                          setIsNewDept(true);
                          setFormData({ ...formData, department: "" });
                        } else {
                          setFormData({ ...formData, department: e.target.value });
                        }
                      }}
                    >
                      <option value="">— None —</option>
                      {departments.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                      <option value={NEW_DEPT_SENTINEL}>＋ Add new department…</option>
                    </select>
                  ) : (
                    <div className="flex gap-1.5">
                      <Input
                        autoFocus
                        placeholder="New department name"
                        value={formData.department}
                        onChange={e => setFormData({ ...formData, department: e.target.value })}
                      />
                      <button
                        type="button"
                        className="text-xs text-muted-foreground underline whitespace-nowrap hover:text-foreground"
                        onClick={() => { setIsNewDept(false); setFormData({ ...formData, department: "" }); }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                <div><Label>Job Title</Label><Input value={formData.jobTitle} onChange={e=>setFormData({...formData, jobTitle: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Phone Number</Label><Input type="tel" placeholder="e.g. +1 555 000 0000" value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})} /></div>
                <div><Label>Staff ID</Label><Input placeholder="e.g. EMP-0042" value={formData.staffId} onChange={e=>setFormData({...formData, staffId: e.target.value})} /></div>
              </div>
              {mutationError && (
                <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{mutationError}</span>
                </div>
              )}
              <Button className="w-full mt-4" type="submit" isLoading={createMutation.isPending || updateMutation.isPending}>Save User</Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
