import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Clock3, History, Laptop, MoreHorizontal,
  RefreshCw, Search, ShieldCheck, ShieldOff, XCircle,
} from "lucide-react";
import { PageHeader, Card, Button, Input, PasswordInput, Label } from "@/components/shared";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
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

type RecoveryCase = {
  id: number | string;
  status: "pending" | "approved" | "rejected" | "expired" | string;
  name?: string;
  email?: string;
  requestedAt?: string;
  expiresAt?: string;
  resolvedAt?: string;
  ipAddress?: string;
  browser?: string;
  userAgent?: string;
  recurrenceCount?: number;
  riskFlags?: string[];
  rejectionReason?: string;
  reviewedBy?: string;
};

type RecoverySummary = {
  pending?: number;
  approved?: number;
  rejected?: number;
  expired?: number;
  total?: number;
};

const formatDate = (value?: string) => {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const caseName = (item: any) => item.name || item.userName || item.user?.name || "Unknown user";
const caseEmail = (item: any) => item.email || item.userEmail || item.user?.email || "";

export default function AccountRecovery() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<RecoveryUser[]>([]);
  const [cases, setCases] = useState<RecoveryCase[]>([]);
  const [summary, setSummary] = useState<RecoverySummary>({});
  const [loading, setLoading] = useState(true);
  const [casesLoading, setCasesLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [section, setSection] = useState<"pending" | "history" | "accounts">("pending");
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<RecoveryUser | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [approveTarget, setApproveTarget] = useState<RecoveryCase | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RecoveryCase | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [caseAction, setCaseAction] = useState(false);

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

  const loadCases = async () => {
    setCasesLoading(true);
    try {
      const response = await apiFetch("/api/account-recovery/requests?status=all");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to load recovery requests.");
      const items = Array.isArray(data) ? data : data.requests || data.cases || [];
      setCases(items);
      setSummary(Array.isArray(data) ? {} : data.summary || {});
    } catch (error: any) {
      toast({ title: "Could not load recovery requests", description: error.message || "Please try again.", variant: "destructive" });
    } finally {
      setCasesLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadCases();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((account) => [account.name, account.email].some((value) => value?.toLowerCase().includes(query)));
  }, [users, search]);

  const visibleCases = useMemo(() => {
    const pending = section === "pending";
    const query = search.trim().toLowerCase();
    return cases.filter((item) => {
      if (pending ? item.status !== "pending" : item.status === "pending") return false;
      return !query || [caseName(item), caseEmail(item), item.ipAddress, item.browser, item.userAgent]
        .some((value) => value?.toLowerCase().includes(query));
    });
  }, [cases, search, section]);

  const counts = {
    pending: summary.pending ?? cases.filter((item) => item.status === "pending").length,
    approved: summary.approved ?? cases.filter((item) => item.status === "approved").length,
    rejected: summary.rejected ?? cases.filter((item) => item.status === "rejected").length,
    expired: summary.expired ?? cases.filter((item) => item.status === "expired").length,
  };

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
        method: "POST", body: JSON.stringify({ temporaryPassword }),
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

  const approveCase = async () => {
    if (!approveTarget) return;
    setCaseAction(true);
    try {
      const response = await apiFetch(`/api/account-recovery/requests/${approveTarget.id}/approve`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not approve this request.");
      toast({ title: "Recovery approved", description: `${caseName(approveTarget)} can now return to sign in.` });
      setApproveTarget(null);
      await loadCases();
    } catch (error: any) {
      toast({ title: "Request not approved", description: error.message || "Please try again.", variant: "destructive" });
    } finally {
      setCaseAction(false);
    }
  };

  const rejectCase = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rejectTarget || !rejectReason.trim()) return;
    setCaseAction(true);
    try {
      const response = await apiFetch(`/api/account-recovery/requests/${rejectTarget.id}/reject`, {
        method: "POST", body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not reject this request.");
      toast({ title: "Recovery rejected", description: "The recovery request has been closed." });
      setRejectTarget(null);
      setRejectReason("");
      await loadCases();
    } catch (error: any) {
      toast({ title: "Request not rejected", description: error.message || "Please try again.", variant: "destructive" });
    } finally {
      setCaseAction(false);
    }
  };

  if (!currentUser || !hasMenuAccess(currentUser, "account-recovery")) return <div className="p-8 text-destructive">Unauthorized</div>;

  return (
    <div>
      <PageHeader title="Account Recovery" description="Review recovery requests and help colleagues regain access securely.">
        <Button variant="outline" onClick={() => { loadCases(); if (section === "accounts") loadUsers(); }} disabled={casesLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${casesLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6" aria-label="Recovery request summary">
        {[
          ["Pending", counts.pending, Clock3, "text-amber-600"],
          ["Approved", counts.approved, CheckCircle2, "text-emerald-600"],
          ["Rejected", counts.rejected, XCircle, "text-red-600"],
          ["Expired", counts.expired, History, "text-slate-500"],
        ].map(([label, value, Icon, color]: any) => (
          <Card key={label} className="p-4 hover:shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold mt-1">{value}</p></div>
              <Icon className={`w-6 h-6 ${color}`} aria-hidden="true" />
            </div>
          </Card>
        ))}
      </div>

      <div className="flex overflow-x-auto border-b border-border mb-5" role="tablist" aria-label="Account recovery sections">
        {[
          ["pending", `Pending (${counts.pending})`],
          ["history", "History"],
          ["accounts", "Account actions"],
        ].map(([value, label]) => (
          <button key={value} type="button" role="tab" aria-selected={section === value} onClick={() => { setSection(value as any); setSearch(""); }}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${section === value ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="relative max-w-md mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input aria-label={`Search ${section}`} className="pl-9" placeholder={section === "accounts" ? "Search name or email…" : "Search requests…"} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {section !== "accounts" ? (
        casesLoading ? <Card className="p-8 text-muted-foreground animate-pulse">Loading recovery requests…</Card> :
        visibleCases.length === 0 ? (
          <Card className="p-10 text-center">
            <ShieldCheck className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <h2 className="font-semibold">{section === "pending" ? "No pending requests" : "No recovery history"}</h2>
            <p className="text-sm text-muted-foreground mt-1">{search ? "No requests match your search." : section === "pending" ? "New recovery requests will appear here." : "Completed requests will appear here."}</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {visibleCases.map((item) => {
              const rawFlags = item.riskFlags || (item as any).flags || [];
              const flags: string[] = Array.isArray(rawFlags) ? [...rawFlags.map(String)] : rawFlags ? [String(rawFlags)] : [];
              const recurrence = item.recurrenceCount ?? (item as any).previousRequestCount ?? (item as any).attemptCount ?? 0;
              if ((item as any).highRisk && !flags.includes("High risk")) flags.push("High risk");
              if ((item as any).riskLevel && !flags.includes(`${(item as any).riskLevel} risk`)) flags.push(`${(item as any).riskLevel} risk`);
              const recurring = recurrence > 1 || (item as any).isRecurring === true || (item as any).recurring === true;
              return (
                <Card key={item.id} className="p-5 overflow-visible">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold text-lg truncate">{caseName(item)}</h2>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                          item.status === "approved" ? "bg-emerald-100 text-emerald-800" :
                          item.status === "rejected" ? "bg-red-100 text-red-800" :
                          item.status === "expired" ? "bg-slate-100 text-slate-700" : "bg-amber-100 text-amber-800"
                        }`}>{item.status}</span>
                      </div>
                      <p className="text-sm text-muted-foreground break-all">{caseEmail(item)}</p>
                      <dl className="grid sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-3 mt-4 text-sm">
                        <div><dt className="text-muted-foreground">Requested</dt><dd className="font-medium">{formatDate(item.requestedAt || (item as any).createdAt)}</dd></div>
                        <div><dt className="text-muted-foreground">Expires</dt><dd className="font-medium">{formatDate(item.expiresAt)}</dd></div>
                        <div><dt className="text-muted-foreground">IP address</dt><dd className="font-mono text-xs mt-1">{item.ipAddress || (item as any).ip || "Not available"}</dd></div>
                        <div className="sm:col-span-2"><dt className="text-muted-foreground flex items-center gap-1"><Laptop className="w-3.5 h-3.5" /> Browser / device</dt><dd className="font-medium break-words">{item.browser || item.userAgent || (item as any).device || "Not available"}</dd></div>
                        {item.resolvedAt && <div><dt className="text-muted-foreground">Resolved</dt><dd className="font-medium">{formatDate(item.resolvedAt)}</dd></div>}
                      </dl>
                      {(recurring || flags.length > 0) && (
                        <div className="flex flex-wrap gap-2 mt-4" aria-label="Risk indicators">
                          {recurring && <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 text-amber-900 px-2 py-1 text-xs font-medium"><RefreshCw className="w-3 h-3" /> Repeated request{recurrence > 1 ? ` (${recurrence})` : ""}</span>}
                          {flags.map((flag: string) => <span key={flag} className="inline-flex items-center gap-1 rounded-md bg-red-100 text-red-900 px-2 py-1 text-xs font-medium"><AlertTriangle className="w-3 h-3" /> {flag}</span>)}
                        </div>
                      )}
                      {item.rejectionReason && <p className="mt-4 text-sm"><span className="text-muted-foreground">Rejection reason:</span> {item.rejectionReason}</p>}
                    </div>
                    {item.status === "pending" && (
                      <div className="flex gap-2 w-full lg:w-auto">
                        <Button variant="outline" className="flex-1" onClick={() => { setRejectTarget(item); setRejectReason(""); }}>Reject</Button>
                        <Button className="flex-1" onClick={() => setApproveTarget(item)}>Approve</Button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : (
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
      )}

      <Dialog open={!!approveTarget} onOpenChange={(open) => !open && !caseAction && setApproveTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Approve recovery request?</DialogTitle><DialogDescription>Only approve if the request details are consistent with the account holder.</DialogDescription></DialogHeader>
          <div className="rounded-xl bg-muted/50 p-4 text-sm"><strong>{approveTarget && caseName(approveTarget)}</strong><div className="text-muted-foreground">{approveTarget && caseEmail(approveTarget)}</div></div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setApproveTarget(null)} disabled={caseAction}>Cancel</Button>
            <Button onClick={approveCase} isLoading={caseAction}>Confirm approval</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open && !caseAction) { setRejectTarget(null); setRejectReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Reject recovery request</DialogTitle><DialogDescription>Provide a clear reason for rejecting {rejectTarget && caseName(rejectTarget)}’s request.</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={rejectCase}>
            <div><Label>Reason</Label><Textarea aria-label="Rejection reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Explain why this request cannot be approved…" rows={4} required autoFocus /></div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRejectTarget(null)} disabled={caseAction}>Cancel</Button>
              <Button type="submit" variant="destructive" isLoading={caseAction} disabled={!rejectReason.trim()}>Reject request</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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