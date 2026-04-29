import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useListUsers, useCreateUser, useUpdateUser, useDeleteUser } from "../lib";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, Card, Button, Input, Label } from "@/components/shared";
import { Users as UsersIcon, Plus, Edit, Trash2, X, Search, ChevronDown, AlertCircle, Camera, UserCircle2, ExternalLink } from "lucide-react";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Site { id: number; name: string; city?: string | null; country?: string | null; }

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}`, "Content-Type": "application/json" });

const NEW_DEPT_SENTINEL = "__new__";

export default function Users() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoTarget, setPhotoTarget] = useState<{ id: number; name: string; currentPhoto?: string | null } | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  
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
    apiFetch("/api/custom-roles")
      .then(r => r.json())
      .then(data => Array.isArray(data) && setCustomRoles(data))
      .catch(() => {});
    apiFetch("/api/departments")
      .then(r => r.json())
      .then(data => Array.isArray(data) && setDepartments(data.map((d: any) => d.name ?? d)))
      .catch(() => {});
    apiFetch("/api/sites")
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

  const handlePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !photoTarget) return;
    setPhotoUploading(true);
    try {
      // Compress image to ~400x400 max via canvas
      const bitmap = await createImageBitmap(file);
      const maxDim = 400;
      const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
      const w = Math.round(bitmap.width * scale);
      const h = Math.round(bitmap.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const r = await apiFetch(`/api/users/${photoTarget.id}/profile-photo`, {
        method: "PUT",
        body: JSON.stringify({ profilePhoto: dataUrl }),
      });
      if (!r.ok) throw new Error("Upload failed");
      toast({ title: "Reference photo saved", description: `${photoTarget.name}'s reference photo updated.` });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setPhotoTarget(null);
    } catch {
      toast({ title: "Error", description: "Could not save photo. Please try again.", variant: "destructive" });
    } finally {
      setPhotoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleSelect = (id: number) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (selectedIds.size === filteredUsers.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredUsers.map(u => u.id)));
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} selected user(s)?`)) return;
    setBulkDeleting(true);
    await Promise.all([...selectedIds].map(id => apiFetch(`/api/users/${id}`, { method: "DELETE" })));
    queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    setSelectedIds(new Set());
    setBulkDeleting(false);
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

      <BulkActionBar count={selectedIds.size} onDelete={handleBulkDelete} onClear={() => setSelectedIds(new Set())} deleting={bulkDeleting} />

      <Card className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[720px]">
          <thead>
            <tr className="bg-muted/50 border-b text-sm text-muted-foreground">
              <th className="p-4 w-10">
                <input
                  type="checkbox"
                  checked={filteredUsers.length > 0 && selectedIds.size === filteredUsers.length}
                  onChange={toggleAll}
                  className="w-4 h-4 accent-primary cursor-pointer"
                />
              </th>
              <th className="p-4">Name</th>
              <th className="p-4 hidden sm:table-cell">Role</th>
              <th className="p-4 hidden md:table-cell">Department / Title</th>
              <th className="p-4 hidden lg:table-cell">Phone / Staff ID</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredUsers.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground text-sm">No users match the current filters.</td></tr>
            )}
            {filteredUsers.map(u => (
              <tr key={u.id} className={`hover:bg-muted/30 ${selectedIds.has(u.id) ? "bg-primary/5" : ""}`}>
                <td className="p-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(u.id)}
                    onChange={() => toggleSelect(u.id)}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                </td>
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
                      title="Set reference photo for face review"
                      onClick={() => setPhotoTarget({ id: u.id, name: u.name, currentPhoto: (u as any).profilePhoto })}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Photo</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => navigate(`/staff?id=${u.id}`)}
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> View
                    </Button>
                    {(user?.role === 'super_admin' || !['admin','super_admin'].includes(u.role)) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => { setMutationError(null); setFormData({ name: u.name, email: u.email, password: "", role: u.role, customRoleId: u.customRole?.id?.toString() || "", siteId: (u as any).siteId?.toString() || "", department: u.department||"", jobTitle: u.jobTitle||"", phone: u.phone||"", staffId: u.staffId||"" }); setEditingId(u.id); setIsNewDept(false); setIsDialogOpen(true); }}
                      >
                        <Edit className="w-3.5 h-3.5" /> Edit
                      </Button>
                    )}
                    {(user?.role === 'super_admin' || !['admin','super_admin'].includes(u.role)) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleDelete(u.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Hidden file input for photo capture */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={handlePhotoFile}
      />

      {/* Reference Photo Dialog */}
      <Dialog open={!!photoTarget} onOpenChange={v => { if (!v) setPhotoTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" /> Set Reference Photo
            </DialogTitle>
            <p className="text-xs text-muted-foreground pt-0.5">
              This photo will be used to verify identity against attendance selfies for <strong>{photoTarget?.name}</strong>.
            </p>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {photoTarget?.currentPhoto ? (
              <div className="flex flex-col items-center gap-1">
                <img src={photoTarget.currentPhoto} alt="Current reference" className="w-32 h-32 rounded-full object-cover border-2 border-primary/40" />
                <span className="text-xs text-muted-foreground">Current reference photo</span>
              </div>
            ) : (
              <div className="w-32 h-32 rounded-full border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 bg-muted/30">
                <UserCircle2 className="w-10 h-10 text-muted-foreground/40" />
                <span className="text-[11px] text-muted-foreground">No photo yet</span>
              </div>
            )}
            <Button
              className="w-full gap-2"
              disabled={photoUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="w-4 h-4" />
              {photoUploading ? "Saving…" : photoTarget?.currentPhoto ? "Replace Photo" : "Take / Upload Photo"}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              On mobile this opens the front camera. On desktop you can select a photo file.
            </p>
          </div>
        </DialogContent>
      </Dialog>

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
