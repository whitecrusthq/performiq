import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Search, ShieldCheck, ShieldOff } from "lucide-react";
import { PageHeader, Card, Button, Input, PasswordInput, Label } from "@/components/shared";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { hasMenuAccess } from "@/lib/menu-permissions";
import { apiFetch } from "@/lib/utils";

type RecoveryUser = {
  id: number;
  name: string;
  email: string;
  twoFactorEnabled: boolean;
  isActive: boolean;
};

export default function AccountRecovery() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<RecoveryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<RecoveryUser | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/account-recovery/users");
      if (!response.ok) throw new Error("Unable to load accounts.");
      const data = await response.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast({ title: "Could not load accounts", description: error.message || "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((account) => [account.name, account.email]
      .some((value) => value?.toLowerCase().includes(query)));
  }, [users, search]);

  const closePasswordDialog = () => {
    setPasswordTarget(null);
    setTemporaryPassword("");
    setConfirmation("");
  };

  const setTemporary = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!passwordTarget) return;
    if (temporaryPassword.length < 8) {
      toast({ title: "Password is too short", description: "Temporary passwords must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (temporaryPassword !== confirmation) {
      toast({ title: "Passwords do not match", description: "Enter the same password in both fields.", variant: "destructive" });
      return;
    }
    if (!confirm(`Set a temporary password for ${passwordTarget.name}? They will need to choose a new password when signing in.`)) return;
    setSaving(true);
    try {
      const response = await apiFetch(`/api/account-recovery/users/${passwordTarget.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temporaryPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not set the temporary password.");
      toast({ title: "Temporary password set", description: `${passwordTarget.name} must change it when signing in.` });
      closePasswordDialog();
      loadUsers();
    } catch (error: any) {
      toast({ title: "Password not changed", description: error.message || "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const reset2FA = async (account: RecoveryUser) => {
    setOpenMenu(null);
    if (!confirm(`Reset two-factor authentication for ${account.name}? Their authenticator app and backup codes will stop working.`)) return;
    try {
      const response = await apiFetch(`/api/account-recovery/users/${account.id}/reset-2fa`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not reset two-factor authentication.");
      toast({ title: "2FA reset", description: `${account.name} can set up two-factor authentication again at sign in.` });
      loadUsers();
    } catch (error: any) {
      toast({ title: "2FA was not reset", description: error.message || "Please try again.", variant: "destructive" });
    }
  };

  if (!currentUser || !hasMenuAccess(currentUser, "account-recovery")) return <div className="p-8 text-destructive">Unauthorized</div>;

  return (
    <div>
      <PageHeader title="Account Recovery" description="Help a colleague regain access without editing their account profile." />
      <div className="relative max-w-md mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input aria-label="Search accounts" className="pl-9" placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <Card className="overflow-visible">
        {loading ? <div className="p-8 text-muted-foreground animate-pulse">Loading accounts…</div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left border-collapse">
              <thead><tr className="bg-muted/50 border-b text-sm text-muted-foreground">
                <th className="p-4">Account</th><th className="p-4">Security</th><th className="p-4 w-16"><span className="sr-only">Actions</span></th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.length === 0 ? <tr><td colSpan={3} className="p-8 text-center text-sm text-muted-foreground">No accounts match your search.</td></tr> :
                  filteredUsers.map((account) => <tr key={account.id} className="hover:bg-muted/30">
                    <td className="p-4"><div className="font-semibold">{account.name}</div><div className="text-sm text-muted-foreground">{account.email}</div></td>
                    <td className="p-4"><span className={`inline-flex items-center gap-1 text-xs font-medium ${account.twoFactorEnabled ? "text-emerald-700" : "text-muted-foreground"}`}>{account.twoFactorEnabled ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}{account.twoFactorEnabled ? "2FA enabled" : "2FA not enabled"}</span></td>
                    <td className="p-4 text-right relative">
                      <button type="button" aria-label={`Recovery actions for ${account.name}`} aria-expanded={openMenu === account.id} onClick={() => setOpenMenu(openMenu === account.id ? null : account.id)} className="p-2 rounded-lg hover:bg-muted"><MoreHorizontal className="w-5 h-5" /></button>
                      {openMenu === account.id && <div className="absolute right-4 top-12 z-20 w-52 rounded-lg border border-border bg-popover shadow-lg p-1 text-left">
                        <button type="button" onClick={() => { setOpenMenu(null); setPasswordTarget(account); }} className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted">Set Temporary Password</button>
                        <button type="button" disabled={!account.twoFactorEnabled} onClick={() => reset2FA(account)} className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed">Reset 2FA</button>
                      </div>}
                    </td>
                  </tr>)}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Dialog open={!!passwordTarget} onOpenChange={(open) => !open && closePasswordDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Set Temporary Password</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Set a temporary password for <strong>{passwordTarget?.name}</strong>. They will be required to change it at their next sign in.</p>
          <form className="space-y-4" onSubmit={setTemporary}>
            <div><Label>Temporary password</Label><PasswordInput value={temporaryPassword} onChange={(e) => setTemporaryPassword(e.target.value)} minLength={8} required /></div>
            <div><Label>Confirm temporary password</Label><PasswordInput value={confirmation} onChange={(e) => setConfirmation(e.target.value)} minLength={8} required /></div>
            <Button type="submit" className="w-full" isLoading={saving}>Set Temporary Password</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}