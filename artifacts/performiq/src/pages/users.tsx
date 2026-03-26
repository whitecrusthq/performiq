import { useState, useEffect } from "react";
import { useListUsers, useCreateUser, useUpdateUser, useDeleteUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, Card, Button, Input, Label } from "@/components/shared";
import { Users as UsersIcon, Plus, Edit, Trash2, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

type CustomRole = { id: number; name: string; permissionLevel: string };
const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}`, "Content-Type": "application/json" });

export default function Users() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
  
  const { data: users, isLoading } = useListUsers({ request: { headers } });
  
  const createMutation = useCreateUser({ request: { headers } });
  const updateMutation = useUpdateUser({ request: { headers } });
  const deleteMutation = useDeleteUser({ request: { headers } });

  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "", password: "", role: "employee" as any, customRoleId: "", department: "", jobTitle: "" });

  useEffect(() => {
    fetch("/api/custom-roles", { headers: authHeader() })
      .then(r => r.json())
      .then(data => Array.isArray(data) && setCustomRoles(data))
      .catch(() => {});
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const base: any = {
      name: formData.name,
      email: formData.email,
      role: formData.role,
      customRoleId: formData.customRoleId ? parseInt(formData.customRoleId) : null,
      department: formData.department,
      jobTitle: formData.jobTitle,
    };
    if (editingId) {
      if (formData.password.trim() !== "") base.password = formData.password;
      updateMutation.mutate({ id: editingId, data: base }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/users"] }); setIsDialogOpen(false); }
      });
    } else {
      base.password = formData.password;
      createMutation.mutate({ data: base }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/users"] }); setIsDialogOpen(false); }
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete user?")) deleteMutation.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/users"] }) });
  };

  if (isLoading) return <div className="p-8">Loading users...</div>;
  if (user?.role !== 'admin' && user?.role !== 'super_admin') return <div className="p-8 text-destructive">Unauthorized</div>;

  return (
    <div>
      <PageHeader title="User Management" description="Manage platform access and organizational structure.">
        <Button onClick={() => { setFormData({ name: "", email: "", password: "", role: "employee", customRoleId: "", department: "", jobTitle: "" }); setEditingId(null); setIsDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add User
        </Button>
      </PageHeader>

      <Card className="overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b text-sm text-muted-foreground">
              <th className="p-4">Name</th>
              <th className="p-4 hidden sm:table-cell">Role</th>
              <th className="p-4 hidden md:table-cell">Department / Title</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users?.map(u => (
              <tr key={u.id} className="hover:bg-muted/30">
                <td className="p-4">
                  <div className="font-semibold text-foreground">{u.name}</div>
                  <div className="text-sm text-muted-foreground">{u.email}</div>
                </td>
                <td className="p-4 hidden sm:table-cell">
                  <div className="flex flex-col gap-1">
                    {(u as any).customRole ? (
                      <span className="font-medium text-sm">{(u as any).customRole.name}</span>
                    ) : null}
                    <span className={`px-2 py-0.5 rounded text-xs font-medium w-fit capitalize ${u.role==='super_admin'?'bg-violet-100 text-violet-700':u.role==='admin'?'bg-purple-100 text-purple-700':u.role==='manager'?'bg-blue-100 text-blue-700':'bg-slate-100 text-slate-700'}`}>{u.role === 'super_admin' ? 'Super Admin' : u.role}</span>
                  </div>
                </td>
                <td className="p-4 hidden md:table-cell text-sm">
                  {u.department && <div>{u.department}</div>}
                  {u.jobTitle && <div className="text-muted-foreground">{u.jobTitle}</div>}
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => { setFormData({ name: u.name, email: u.email, password: "", role: u.role, customRoleId: (u as any).customRole?.id?.toString() || "", department: u.department||"", jobTitle: u.jobTitle||"" }); setEditingId(u.id); setIsDialogOpen(true); }}
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
          <Card className="w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">{editingId ? "Edit User" : "Create User"}</h2>
              <button onClick={() => setIsDialogOpen(false)}><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label>Name</Label><Input value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} required /></div>
              <div><Label>Email</Label><Input type="email" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} required /></div>
              <div>
                <Label>{editingId ? "New Password" : "Password"}</Label>
                <Input type="password" placeholder={editingId ? "Leave blank to keep unchanged" : ""} value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})} required={!editingId} />
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
                <div><Label>Department</Label><Input value={formData.department} onChange={e=>setFormData({...formData, department: e.target.value})} /></div>
                <div><Label>Job Title</Label><Input value={formData.jobTitle} onChange={e=>setFormData({...formData, jobTitle: e.target.value})} /></div>
              </div>
              <Button className="w-full mt-4" type="submit" isLoading={createMutation.isPending || updateMutation.isPending}>Save User</Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
