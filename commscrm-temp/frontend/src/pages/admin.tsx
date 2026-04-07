import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users, UserPlus, ShieldCheck, Headphones, Search,
  Loader2, MoreHorizontal, Pencil, PowerOff, Power, Lock, LayoutGrid, Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiGet, apiPost, apiPut, apiDelete, getBaseUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Redirect } from "wouter";

interface ApiAgent {
  id: number;
  name: string;
  email: string;
  role: "super_admin" | "admin" | "agent" | "supervisor";
  isActive: boolean;
  allowedMenus: string[] | null;
  activeConversations: number;
  resolvedToday: number;
  rating: number;
  createdAt: string;
}

const ROLE_META: Record<string, { label: string; badge: string }> = {
  super_admin: { label: "Super Admin", badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  admin:       { label: "Admin",       badge: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  supervisor:  { label: "Supervisor",  badge: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300" },
  agent:       { label: "Agent",       badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
};

interface MenuDef { slug: string; label: string; category: "agent" | "backoffice" }

const ALL_MENUS: MenuDef[] = [
  { slug: "dashboard",     label: "Dashboard",     category: "agent" },
  { slug: "inbox",         label: "Inbox",         category: "agent" },
  { slug: "follow-ups",    label: "Follow-ups",    category: "agent" },
  { slug: "feedback",      label: "Feedback",      category: "agent" },
  { slug: "customers",     label: "Customers",     category: "agent" },
  { slug: "clock-in",      label: "Clock In",      category: "agent" },
  { slug: "ai-chat",       label: "AI Assistant",  category: "agent" },
  { slug: "campaigns",     label: "Campaigns",     category: "backoffice" },
  { slug: "analytics",     label: "Analytics",     category: "backoffice" },
  { slug: "intelligence",  label: "Intelligence",  category: "backoffice" },
  { slug: "transcripts",   label: "Transcripts",   category: "backoffice" },
  { slug: "product-demand",label: "Product Demand",category: "backoffice" },
  { slug: "channels",      label: "Channels",      category: "backoffice" },
  { slug: "settings",      label: "Settings",      category: "backoffice" },
];

const ALL_SLUGS = ALL_MENUS.map((m) => m.slug);

function RolePicker({ value, onChange, isSuperAdmin }: { value: string; onChange: (v: string) => void; isSuperAdmin: boolean }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        {isSuperAdmin && (
          <SelectItem value="admin">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-red-500" />
              <span className="font-medium">Admin</span>
              <span className="text-muted-foreground text-xs ml-1">Full access, user management</span>
            </div>
          </SelectItem>
        )}
        <SelectItem value="supervisor">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-violet-500" />
            <span className="font-medium">Supervisor</span>
            <span className="text-muted-foreground text-xs ml-1">Manage agents, view all queues</span>
          </div>
        </SelectItem>
        <SelectItem value="agent">
          <div className="flex items-center gap-2">
            <Headphones className="h-4 w-4 text-blue-500" />
            <span className="font-medium">Agent</span>
            <span className="text-muted-foreground text-xs ml-1">Handle conversations</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

function MenuAssignModal({ agent, onClose, onSave }: {
  agent: ApiAgent;
  onClose: () => void;
  onSave: (agentId: number, menus: string[] | null) => void;
}) {
  const initial = agent.allowedMenus ?? ALL_SLUGS;
  const [selected, setSelected] = useState<Set<string>>(new Set(initial));
  const [saving, setSaving] = useState(false);

  const toggle = (slug: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === ALL_SLUGS.length) setSelected(new Set());
    else setSelected(new Set(ALL_SLUGS));
  };

  const agentMenus = ALL_MENUS.filter((m) => m.category === "agent");
  const backofficeMenus = ALL_MENUS.filter((m) => m.category === "backoffice");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-primary" />
            Assign Menu Access
          </DialogTitle>
          <DialogDescription>
            Choose which pages <strong>{agent.name}</strong> can see in their sidebar.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Avatar className="h-9 w-9 border">
              <AvatarImage src={`https://i.pravatar.cc/150?u=${agent.email}`} />
              <AvatarFallback className="text-xs">{agent.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium text-sm">{agent.name}</p>
              <p className="text-xs text-muted-foreground">{agent.email} · {ROLE_META[agent.role]?.label ?? agent.role}</p>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={toggleAll}>
              {selected.size === ALL_SLUGS.length ? "Deselect All" : "Select All"}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Agent Tasks</p>
              {agentMenus.map((m) => (
                <label key={m.slug} className="flex items-center gap-2.5 py-1.5 cursor-pointer hover:text-foreground text-sm">
                  <Checkbox
                    checked={selected.has(m.slug)}
                    onCheckedChange={() => toggle(m.slug)}
                    id={`menu-${m.slug}`}
                  />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Back Office</p>
              {backofficeMenus.map((m) => (
                <label key={m.slug} className="flex items-center gap-2.5 py-1.5 cursor-pointer hover:text-foreground text-sm">
                  <Checkbox
                    checked={selected.has(m.slug)}
                    onCheckedChange={() => toggle(m.slug)}
                    id={`menu-${m.slug}`}
                  />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {selected.size} of {ALL_SLUGS.length} menus selected
            {selected.size === ALL_SLUGS.length && " (full access)"}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              const menus = selected.size === ALL_SLUGS.length ? null : Array.from(selected);
              await onSave(agent.id, menus);
              setSaving(false);
              onClose();
            }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Admin() {
  const { agent: me } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const isSuperAdmin = me?.role === "super_admin";
  const isAdmin = me?.role === "admin" || isSuperAdmin;

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState("agent");

  const [editTarget, setEditTarget] = useState<ApiAgent | null>(null);
  const [editRole, setEditRole] = useState("");
  const [menuTarget, setMenuTarget] = useState<ApiAgent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiAgent | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  if (!isAdmin) return <Redirect to="/" />;

  const { data: agents = [], isLoading } = useQuery<ApiAgent[]>({
    queryKey: ["agents"],
    queryFn: () => apiGet("/agents"),
  });

  const createMutation = useMutation({
    mutationFn: (data: object) => apiPost("/agents", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      setIsCreateOpen(false);
      setCreateName(""); setCreateEmail(""); setCreatePassword(""); setCreateRole("agent");
      toast({ title: "User created", description: "The new account is ready." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message || "Could not create user.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number; role?: string; isActive?: boolean }) =>
      apiPut(`/agents/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      setEditTarget(null);
      toast({
        title: vars.isActive !== undefined
          ? (vars.isActive ? "User activated" : "User deactivated")
          : "Role updated",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message || "Could not update user.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiDelete(`/agents/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      setDeleteTarget(null);
      setDeleteConfirmName("");
      toast({ title: "User deleted", description: "The account has been permanently removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message || "Could not delete user.", variant: "destructive" });
    },
  });

  const saveMenus = async (agentId: number, menus: string[] | null) => {
    try {
      const token = localStorage.getItem("crm_token");
      const base = getBaseUrl();
      const res = await fetch(`${base}/agents/${agentId}/menus`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ allowedMenus: menus }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: "Failed" })) as { error: string };
        throw new Error(e.error);
      }
      qc.invalidateQueries({ queryKey: ["agents"] });
      toast({ title: "Menu access saved", description: "Changes take effect on next login." });
    } catch (err) {
      toast({ title: "Failed to save", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
  };

  const filtered = useMemo(() => agents.filter((a) => {
    const q = search.toLowerCase();
    return (a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q))
      && (roleFilter === "all" || a.role === roleFilter);
  }), [agents, search, roleFilter]);

  const counts = useMemo(() => ({
    total: agents.length,
    active: agents.filter((a) => a.isActive).length,
    superAdmin: agents.filter((a) => a.role === "super_admin").length,
    admin: agents.filter((a) => a.role === "admin").length,
    supervisor: agents.filter((a) => a.role === "supervisor").length,
    agent: agents.filter((a) => a.role === "agent").length,
  }), [agents]);

  function canEdit(target: ApiAgent): boolean {
    if (target.role === "super_admin") return false;
    if (target.role === "admin" && !isSuperAdmin) return false;
    if (target.id === me?.id) return false;
    return true;
  }

  function lockedReason(target: ApiAgent): string | null {
    if (target.role === "super_admin") return "Super admin — protected";
    if (target.role === "admin" && !isSuperAdmin) return "Admin — super admin only";
    if (target.id === me?.id) return "That's you";
    return null;
  }

  return (
    <div className="p-8 h-full flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground mt-1">
            {isSuperAdmin
              ? "Manage all users, roles, and menu access."
              : "Manage agents and supervisors, and assign menu access."}
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-create-user">
              <UserPlus className="h-4 w-4" />
              {isSuperAdmin ? "Add User" : "Add Agent"}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[460px]">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>Add a team member and assign their role.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-5 py-4">
              <div className="space-y-2">
                <Label htmlFor="cn">Full Name</Label>
                <Input id="cn" placeholder="e.g. Sarah Mitchell" value={createName}
                  onChange={(e) => setCreateName(e.target.value)} data-testid="input-create-name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ce">Email Address</Label>
                <Input id="ce" type="email" placeholder="sarah@commscrm.com" value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)} data-testid="input-create-email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cp">Initial Password</Label>
                <Input id="cp" type="password" placeholder="Minimum 8 characters" value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)} data-testid="input-create-password" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <RolePicker value={createRole} onChange={setCreateRole} isSuperAdmin={isSuperAdmin} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button
                disabled={!createName || !createEmail || !createPassword || createMutation.isPending}
                onClick={() => createMutation.mutate({ name: createName, email: createEmail, password: createPassword, role: createRole })}
                data-testid="button-submit-create-user"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 shrink-0">
        {[
          { label: "Total Users",   value: counts.total,      sub: `${counts.active} active`,    color: "bg-primary/10 text-primary",                                               Icon: Users },
          { label: "Super Admins",  value: counts.superAdmin, sub: "Protected accounts",         color: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",    Icon: ShieldCheck },
          { label: "Supervisors",   value: counts.supervisor, sub: "Team leads",                 color: "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400", Icon: ShieldCheck },
          { label: "Agents",        value: counts.agent,      sub: "Front-line support",         color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",         Icon: Headphones },
        ].map(({ label, value, sub, color, Icon }) => (
          <Card key={label}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="text-2xl font-bold">{isLoading ? "—" : value}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b flex items-center gap-3 shrink-0 bg-muted/20">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name or email…" className="pl-9 bg-background"
              value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-users" />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[150px]" data-testid="select-role-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="supervisor">Supervisor</SelectItem>
              <SelectItem value="agent">Agent</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {filtered.length} user{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10">
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Menu Access</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Active</TableHead>
                <TableHead className="text-right">Resolved</TableHead>
                <TableHead className="text-right">Rating</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell></TableRow>
              ) : filtered.map((agent) => {
                const role = ROLE_META[agent.role] ?? ROLE_META.agent;
                const locked = !canEdit(agent);
                const lockReason = lockedReason(agent);
                const isProtected = agent.role === "super_admin" || agent.role === "admin";
                const menuCount = agent.allowedMenus ? agent.allowedMenus.length : ALL_SLUGS.length;

                return (
                  <TableRow
                    key={agent.id}
                    data-testid={`user-row-${agent.id}`}
                    className={`${!agent.isActive ? "opacity-40" : ""} ${isProtected ? "bg-muted/30" : ""}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-9 w-9 border">
                            <AvatarImage src={`https://i.pravatar.cc/150?u=${agent.email}`} />
                            <AvatarFallback className="text-xs font-semibold">{agent.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          {isProtected && (
                            <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-amber-400 border-2 border-background flex items-center justify-center">
                              <Lock className="h-2 w-2 text-white" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-sm flex items-center gap-1.5">
                            {agent.name}
                            {agent.id === me?.id && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">you</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">{agent.email}</div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="secondary" className={`${role.badge} border-none`}>{role.label}</Badge>
                    </TableCell>

                    <TableCell>
                      {agent.role === "super_admin" ? (
                        <span className="text-xs text-muted-foreground italic">Full access</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {menuCount}/{ALL_SLUGS.length} menus
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-center">
                      <Badge variant="secondary" className={agent.isActive
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-none"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border-none"}>
                        {agent.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right text-sm tabular-nums">{agent.activeConversations}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{agent.resolvedToday}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{agent.rating.toFixed(1)}</TableCell>

                    <TableCell className="text-right">
                      {locked ? (
                        <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground/60">
                          <Lock className="h-3 w-3" />
                          <span className="hidden sm:inline">{lockReason}</span>
                        </div>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"
                              data-testid={`user-actions-${agent.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem className="gap-2 cursor-pointer"
                              onClick={() => { setEditTarget(agent); setEditRole(agent.role); }}>
                              <Pencil className="h-4 w-4" /> Edit Role
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 cursor-pointer"
                              onClick={() => setMenuTarget(agent)}>
                              <LayoutGrid className="h-4 w-4" /> Assign Menus
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className={`gap-2 cursor-pointer ${agent.isActive
                                ? "text-destructive focus:text-destructive"
                                : "text-green-600 focus:text-green-600"}`}
                              onClick={() => updateMutation.mutate({ id: agent.id, isActive: !agent.isActive })}
                              disabled={updateMutation.isPending}>
                              {agent.isActive
                                ? <><PowerOff className="h-4 w-4" /> Deactivate</>
                                : <><Power className="h-4 w-4" /> Activate</>}
                            </DropdownMenuItem>
                            {isSuperAdmin && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                                  onClick={() => { setDeleteTarget(agent); setDeleteConfirmName(""); }}
                                  data-testid={`delete-user-${agent.id}`}>
                                  <Trash2 className="h-4 w-4" /> Delete User
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                  No users found
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>Change the role assigned to {editTarget?.name}.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Avatar className="h-9 w-9 border">
                <AvatarImage src={`https://i.pravatar.cc/150?u=${editTarget?.email}`} />
                <AvatarFallback className="text-xs">{editTarget?.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{editTarget?.name}</p>
                <p className="text-xs text-muted-foreground">{editTarget?.email}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>New Role</Label>
              <RolePicker value={editRole} onChange={setEditRole} isSuperAdmin={isSuperAdmin} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button
              disabled={!editRole || editRole === editTarget?.role || updateMutation.isPending}
              onClick={() => editTarget && updateMutation.mutate({ id: editTarget.id, role: editRole })}
              data-testid="button-save-role">
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Menu Assignment Modal */}
      {menuTarget && (
        <MenuAssignModal
          agent={menuTarget}
          onClose={() => setMenuTarget(null)}
          onSave={saveMenus}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirmName(""); } }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete User Account
            </DialogTitle>
            <DialogDescription>
              This action is <strong>permanent and cannot be undone</strong>. All data associated with this account will be removed.
            </DialogDescription>
          </DialogHeader>

          {deleteTarget && (
            <div className="py-2 space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                <Avatar className="h-10 w-10 border border-destructive/20">
                  <AvatarImage src={`https://i.pravatar.cc/150?u=${deleteTarget.email}`} />
                  <AvatarFallback className="text-sm font-semibold">{deleteTarget.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-sm">{deleteTarget.name}</p>
                  <p className="text-xs text-muted-foreground">{deleteTarget.email}</p>
                  <Badge variant="secondary" className={`mt-1 text-[10px] border-none ${ROLE_META[deleteTarget.role]?.badge}`}>
                    {ROLE_META[deleteTarget.role]?.label}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delete-confirm">
                  Type <strong>{deleteTarget.name}</strong> to confirm deletion
                </Label>
                <Input
                  id="delete-confirm"
                  placeholder={deleteTarget.name}
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  className="border-destructive/50 focus-visible:ring-destructive"
                  data-testid="input-delete-confirm"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteConfirmName(""); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmName !== deleteTarget?.name || deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><Trash2 className="h-4 w-4 mr-1" /> Permanently Delete</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
