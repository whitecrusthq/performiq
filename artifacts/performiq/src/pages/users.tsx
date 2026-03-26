import { useState } from "react";
import { useListUsers, useCreateUser, useUpdateUser, useDeleteUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, Card, Button, Input, Label, StatusBadge } from "@/components/shared";
import { Users as UsersIcon, Plus, Edit, Trash2, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function Users() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
  
  const { data: users, isLoading } = useListUsers({ request: { headers } });
  
  const createMutation = useCreateUser({ request: { headers } });
  const updateMutation = useUpdateUser({ request: { headers } });
  const deleteMutation = useDeleteUser({ request: { headers } });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "", password: "", role: "employee" as any, department: "", jobTitle: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      const updateData: any = { name: formData.name, email: formData.email, role: formData.role, department: formData.department, jobTitle: formData.jobTitle };
      if (formData.password.trim() !== "") updateData.password = formData.password;
      updateMutation.mutate({ id: editingId, data: updateData }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/users"] }); setIsDialogOpen(false); }
      });
    } else {
      createMutation.mutate({ data: formData }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/users"] }); setIsDialogOpen(false); }
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete user?")) deleteMutation.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/users"] }) });
  };

  if (isLoading) return <div className="p-8">Loading users...</div>;
  if (user?.role !== 'admin') return <div className="p-8 text-destructive">Unauthorized</div>;

  return (
    <div>
      <PageHeader title="User Management" description="Manage platform access and organizational structure.">
        <Button onClick={() => { setFormData({ name: "", email: "", password: "", role: "employee", department: "", jobTitle: "" }); setEditingId(null); setIsDialogOpen(true); }}>
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
                <td className="p-4 hidden sm:table-cell capitalize">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${u.role==='admin'?'bg-purple-100 text-purple-700':u.role==='manager'?'bg-blue-100 text-blue-700':'bg-slate-100 text-slate-700'}`}>{u.role}</span>
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
                      onClick={() => { setFormData({ name: u.name, email: u.email, password: "", role: u.role, department: u.department||"", jobTitle: u.jobTitle||"" }); setEditingId(u.id); setIsDialogOpen(true); }}
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
              <div>
                <Label>Role</Label>
                <select className="w-full px-4 py-2 border rounded-xl" value={formData.role} onChange={e=>setFormData({...formData, role: e.target.value as any})}>
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
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
