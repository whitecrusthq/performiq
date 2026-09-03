import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LockOpen, Search, ShieldAlert, UserRound } from "lucide-react";
import { PageHeader } from "@/components/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/utils";
import { hasMenuAccess } from "@/lib/menu-permissions";

interface LockedAccount {
  id: number;
  name: string;
  email: string;
  role: string;
  department?: string | null;
  lockedAt: string | null;
  failedLoginAttempts: number;
}

export default function AccountLockManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManage = hasMenuAccess(user, "account-lock-management");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data: locked = [], isLoading } = useQuery<LockedAccount[]>({
    queryKey: ["locked-accounts"],
    enabled: canManage,
    queryFn: async () => {
      const response = await apiFetch("/api/security/locked-accounts");
      if (!response.ok) throw new Error((await response.json()).error || "Failed to load locked accounts");
      return response.json();
    },
    refetchInterval: 30000,
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return locked.filter(account => {
      const matchesSearch = !term || [account.name, account.email, account.department]
        .some(value => value?.toLowerCase().includes(term));
      const matchesRole = !roleFilter || account.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [locked, search, roleFilter]);

  const allFilteredSelected = filtered.length > 0 && filtered.every(account => selectedIds.has(account.id));
  const toggleOne = (id: number) => setSelectedIds(previous => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelectedIds(allFilteredSelected
    ? new Set()
    : new Set(filtered.map(account => account.id)));

  const unlock = useMutation({
    mutationFn: async (ids: number[]) => {
      const response = ids.length === 1
        ? await apiFetch(`/api/security/unlock/${ids[0]}`, { method: "PUT" })
        : await apiFetch("/api/security/unlock", {
            method: "PUT",
            body: JSON.stringify({ userIds: ids }),
          });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to unlock accounts");
      return { result, count: ids.length };
    },
    onSuccess: ({ count }) => {
      queryClient.invalidateQueries({ queryKey: ["locked-accounts"] });
      setSelectedIds(new Set());
      toast({ title: count === 1 ? "Account unlocked" : "Accounts unlocked", description: `${count} account${count === 1 ? "" : "s"} unlocked successfully.` });
    },
    onError: (error: any) => toast({ title: "Could not unlock accounts", description: error?.message || "Please try again.", variant: "destructive" }),
  });

  if (!canManage) return <div className="p-8 text-destructive">Unauthorized</div>;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Account Lock Management" description="Find and unlock accounts blocked after repeated failed login attempts." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LockOpen className="h-5 w-5 text-red-500" />
            Locked Accounts
            {locked.length > 0 && <Badge variant="destructive">{locked.length}</Badge>}
          </CardTitle>
          <CardDescription>Only roles granted Account Lock Management can view or unlock these accounts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm"
                placeholder="Search name, email, or department"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
            </div>
            <select
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={roleFilter}
              onChange={event => setRoleFilter(event.target.value)}
              aria-label="Filter locked accounts by role"
            >
              <option value="">All roles</option>
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
            <Button variant="outline" onClick={toggleAll} disabled={filtered.length === 0}>
              {allFilteredSelected ? "Clear selection" : "Select all"}
            </Button>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <span className="text-sm font-semibold text-primary">{selectedIds.size} selected</span>
              <Button size="sm" onClick={() => unlock.mutate([...selectedIds])} disabled={unlock.isPending}>
                <LockOpen className="mr-2 h-4 w-4" />
                {unlock.isPending ? "Unlocking…" : "Unlock selected"}
              </Button>
            </div>
          )}

          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading locked accounts…</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <ShieldAlert className="h-9 w-9 opacity-30" />
              <p className="text-sm">{locked.length === 0 ? "No accounts are currently locked" : "No locked accounts match your search and filter"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="w-12 p-3">
                      <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} aria-label="Select all filtered accounts" className="h-4 w-4 accent-primary" />
                    </th>
                    <th className="p-3">Account</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Lock details</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map(account => (
                    <tr key={account.id} className={selectedIds.has(account.id) ? "bg-primary/5" : ""}>
                      <td className="p-3">
                        <input type="checkbox" checked={selectedIds.has(account.id)} onChange={() => toggleOne(account.id)} aria-label={`Select ${account.name}`} className="h-4 w-4 accent-primary" />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100">
                            <UserRound className="h-4 w-4 text-red-600" />
                          </div>
                          <div>
                            <div className="font-medium">{account.name}</div>
                            <div className="text-xs text-muted-foreground">{account.email}</div>
                            {account.department && <div className="text-xs text-muted-foreground">{account.department}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 capitalize">{account.role === "super_admin" ? "Super Admin" : account.role}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        <div>{account.failedLoginAttempts} failed attempt{account.failedLoginAttempts === 1 ? "" : "s"}</div>
                        {account.lockedAt && <div>{new Date(account.lockedAt).toLocaleString()}</div>}
                      </td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => unlock.mutate([account.id])} disabled={unlock.isPending}>
                          <LockOpen className="mr-1.5 h-4 w-4" /> Unlock
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}