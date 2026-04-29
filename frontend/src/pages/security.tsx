import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  LockOpen, ShieldAlert, ShieldCheck, User, Clock,
  Smartphone, KeyRound, Copy, Check, Download, AlertCircle, X,
} from "lucide-react";

function authHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface SecuritySettings {
  id: number;
  lockoutEnabled: boolean;
  maxAttempts: number;
  lockoutDurationMinutes: number;
  enforce2faAll?: boolean;
  enforce2faRoles?: string | null;
  updatedAt: string;
}

interface LockedAccount {
  id: number;
  name: string;
  email: string;
  role: string;
  lockedAt: string | null;
  failedLoginAttempts: number;
}

const ROLE_OPTIONS = [
  { value: "super_admin", label: "Super admin" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "employee", label: "Employee" },
];

function parseRoles(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
}

function PersonalTwoFactorCard() {
  const { user, login } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEnabled = !!user?.twoFactorEnabled;

  const [setupOpen, setSetupOpen] = useState(false);
  const [setupQr, setSetupQr] = useState<string>("");
  const [setupSecret, setSetupSecret] = useState<string>("");
  const [setupCode, setSetupCode] = useState("");
  const [setupErr, setSetupErr] = useState<string | null>(null);
  const [setupBusy, setSetupBusy] = useState(false);

  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePw, setDisablePw] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [disableErr, setDisableErr] = useState<string | null>(null);
  const [disableBusy, setDisableBusy] = useState(false);

  const [regenOpen, setRegenOpen] = useState(false);
  const [regenCode, setRegenCode] = useState("");
  const [regenErr, setRegenErr] = useState<string | null>(null);
  const [regenBusy, setRegenBusy] = useState(false);

  const refreshUser = async () => {
    const r = await apiFetch("/api/auth/me", { headers: authHeader() });
    if (r.ok) {
      const me = await r.json();
      const token = localStorage.getItem("token");
      if (token) login(token, me);
    }
    queryClient.invalidateQueries({ queryKey: ["security-settings"] });
  };

  const startSetup = async () => {
    setSetupErr(null); setSetupCode(""); setBackupCodes(null);
    setSetupOpen(true);
    try {
      const r = await apiFetch("/api/auth/2fa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
      });
      const data = await r.json();
      if (!r.ok) { setSetupErr(data.error || "Could not start setup."); return; }
      setSetupQr(data.qrCodeDataUrl); setSetupSecret(data.secret);
    } catch { setSetupErr("Network error. Please try again."); }
  };

  const confirmEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupErr(null); setSetupBusy(true);
    try {
      const r = await apiFetch("/api/auth/2fa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ code: setupCode }),
      });
      const data = await r.json();
      if (!r.ok) { setSetupErr(data.error || "Verification failed."); return; }
      setBackupCodes(data.backupCodes || []);
      await refreshUser();
      toast({ title: "Two-factor enabled", description: "Save your backup codes before closing." });
    } catch { setSetupErr("Network error. Please try again."); }
    finally { setSetupBusy(false); }
  };

  const confirmDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisableErr(null); setDisableBusy(true);
    try {
      const r = await apiFetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ password: disablePw, code: disableCode }),
      });
      const data = await r.json();
      if (!r.ok) { setDisableErr(data.error || "Could not disable 2FA."); return; }
      await refreshUser();
      setDisableOpen(false); setDisablePw(""); setDisableCode("");
      toast({ title: "Two-factor disabled", description: "Your account is now protected by password only." });
    } catch { setDisableErr("Network error. Please try again."); }
    finally { setDisableBusy(false); }
  };

  const confirmRegen = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegenErr(null); setRegenBusy(true);
    try {
      const r = await apiFetch("/api/auth/2fa/backup-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ code: regenCode }),
      });
      const data = await r.json();
      if (!r.ok) { setRegenErr(data.error || "Could not regenerate codes."); return; }
      setBackupCodes(data.backupCodes || []);
      setRegenOpen(false); setRegenCode("");
      setSetupOpen(true);
      toast({ title: "New backup codes generated", description: "Save them — your previous codes no longer work." });
    } catch { setRegenErr("Network error. Please try again."); }
    finally { setRegenBusy(false); }
  };

  const copyCodes = async () => {
    if (!backupCodes) return;
    await navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  };

  const downloadCodes = () => {
    if (!backupCodes) return;
    const blob = new Blob([
      `Backup codes for ${user?.email}\nGenerated ${new Date().toLocaleString()}\n\n` +
      backupCodes.join("\n") + `\n\nKeep these codes safe. Each code can only be used once.\n`
    ], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "performiq-backup-codes.txt";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const closeSetupModal = () => {
    setSetupOpen(false);
    setSetupCode(""); setSetupQr(""); setSetupSecret(""); setSetupErr(null); setBackupCodes(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
          My Two-Factor Authentication
          {isEnabled && <Badge variant="default" className="bg-emerald-500/15 text-emerald-700 border border-emerald-200">Enabled</Badge>}
        </CardTitle>
        <CardDescription>
          Use an authenticator app (Google Authenticator, 1Password, Authy, etc.) to add a second sign-in step.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!isEnabled ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Two-factor authentication is <strong>not enabled</strong> on your account.
            </p>
            <Button onClick={startSetup}><Smartphone className="w-4 h-4 mr-1.5" /> Enable 2FA</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Sign-in is protected by your authenticator app.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => { setRegenOpen(true); setRegenErr(null); setRegenCode(""); }}>
                <KeyRound className="w-4 h-4 mr-1.5" /> Regenerate backup codes
              </Button>
              <Button variant="destructive" onClick={() => { setDisableOpen(true); setDisableErr(null); setDisablePw(""); setDisableCode(""); }}>
                Disable
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {setupOpen && (
        <Modal onClose={closeSetupModal} title={backupCodes ? "Save your backup codes" : "Enable two-factor authentication"}>
          {backupCodes ? (
            <div>
              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 mb-4 flex gap-2 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Save these now — you won't see them again. Each code can be used once.</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-3 mb-3 grid grid-cols-2 gap-2 font-mono text-sm">
                {backupCodes.map((c, i) => (
                  <div key={i} className="bg-background px-3 py-2 rounded border">{c}</div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                <Button variant="outline" size="sm" onClick={copyCodes}>
                  {copied ? <><Check className="w-4 h-4 mr-1.5" /> Copied</> : <><Copy className="w-4 h-4 mr-1.5" /> Copy all</>}
                </Button>
                <Button variant="outline" size="sm" onClick={downloadCodes}>
                  <Download className="w-4 h-4 mr-1.5" /> Download .txt
                </Button>
              </div>
              <Button className="w-full" onClick={closeSetupModal}>Done</Button>
            </div>
          ) : (
            <>
              {setupErr && (
                <div className="bg-destructive/10 border-l-4 border-destructive text-destructive p-3 rounded-r mb-4 text-sm flex gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {setupErr}
                </div>
              )}
              <p className="text-sm text-muted-foreground mb-3">
                1. Scan the QR code with your authenticator app, then 2. enter the 6-digit code below.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="bg-white p-2 rounded-xl border shrink-0">
                  {setupQr
                    ? <img src={setupQr} alt="2FA QR code" className="w-40 h-40" />
                    : <div className="w-40 h-40 bg-muted animate-pulse rounded" />}
                </div>
                <form onSubmit={confirmEnable} className="flex-1 w-full space-y-3">
                  <div>
                    <Label className="text-xs">Manual setup key</Label>
                    <code className="block text-xs font-mono break-all bg-muted px-2 py-1.5 rounded mt-1">{setupSecret || "…"}</code>
                  </div>
                  <div>
                    <Label>6-digit code</Label>
                    <Input
                      inputMode="numeric"
                      pattern="[0-9]{6}" maxLength={6}
                      value={setupCode}
                      onChange={e => setSetupCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                      className="text-center text-xl tracking-[0.4em] font-mono"
                      required autoFocus
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={setupBusy || setupCode.length !== 6}>
                    {setupBusy ? "Verifying…" : "Verify & Enable"}
                  </Button>
                </form>
              </div>
            </>
          )}
        </Modal>
      )}

      {disableOpen && (
        <Modal onClose={() => setDisableOpen(false)} title="Disable two-factor authentication">
          <p className="text-sm text-muted-foreground mb-3">
            Confirm with your password and a current authenticator code.
          </p>
          {disableErr && (
            <div className="bg-destructive/10 border-l-4 border-destructive text-destructive p-3 rounded-r mb-4 text-sm flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {disableErr}
            </div>
          )}
          <form onSubmit={confirmDisable} className="space-y-3">
            <div>
              <Label>Password</Label>
              <Input type="password" value={disablePw} onChange={e => setDisablePw(e.target.value)} required />
            </div>
            <div>
              <Label>6-digit code</Label>
              <Input
                inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                value={disableCode}
                onChange={e => setDisableCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="text-center text-lg tracking-[0.4em] font-mono"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDisableOpen(false)}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={disableBusy}>
                {disableBusy ? "Disabling…" : "Disable 2FA"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {regenOpen && (
        <Modal onClose={() => setRegenOpen(false)} title="Regenerate backup codes">
          <p className="text-sm text-muted-foreground mb-3">
            Enter a current 6-digit code from your authenticator app. Existing backup codes will stop working.
          </p>
          {regenErr && (
            <div className="bg-destructive/10 border-l-4 border-destructive text-destructive p-3 rounded-r mb-4 text-sm flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {regenErr}
            </div>
          )}
          <form onSubmit={confirmRegen} className="space-y-3">
            <div>
              <Label>6-digit code</Label>
              <Input
                inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                value={regenCode}
                onChange={e => setRegenCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="text-center text-lg tracking-[0.4em] font-mono"
                required autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setRegenOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={regenBusy}>{regenBusy ? "Generating…" : "Generate new codes"}</Button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
}

function Modal({ children, title, onClose }: { children: React.ReactNode; title: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-lg p-6 relative">
        <button
          type="button"
          aria-label="Close"
          className="absolute top-3 right-3 p-1 rounded hover:bg-muted text-muted-foreground"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </button>
        <h3 className="text-lg font-semibold font-display mb-4 pr-6">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function Enforce2FACard({ settings }: { settings: SecuritySettings }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [enforceAll, setEnforceAll] = useState(!!settings.enforce2faAll);
  const [enforceRoles, setEnforceRoles] = useState<string[]>(parseRoles(settings.enforce2faRoles));

  useEffect(() => {
    setEnforceAll(!!settings.enforce2faAll);
    setEnforceRoles(parseRoles(settings.enforce2faRoles));
  }, [settings.enforce2faAll, settings.enforce2faRoles]);

  const save = useMutation({
    mutationFn: (data: { enforce2faAll: boolean; enforce2faRoles: string[] }) =>
      apiFetch("/api/security/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(data),
      }).then(r => r.ok ? r.json() : r.json().then((e: any) => Promise.reject(e.error))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-settings"] });
      toast({ title: "Enforcement updated", description: "2FA enforcement settings saved." });
    },
    onError: (e: any) => toast({ title: "Error", description: String(e), variant: "destructive" }),
  });

  const toggleRole = (r: string) => {
    setEnforceRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  };

  const dirty =
    enforceAll !== !!settings.enforce2faAll ||
    JSON.stringify([...enforceRoles].sort()) !== JSON.stringify(parseRoles(settings.enforce2faRoles).sort());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
          Enforce Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Require selected users to set up an authenticator app on their next sign-in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="enforce-all" className="text-sm font-medium">Require 2FA for everyone</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Overrides per-role settings below.</p>
          </div>
          <Switch id="enforce-all" checked={enforceAll} onCheckedChange={setEnforceAll} />
        </div>

        <div className={enforceAll ? "opacity-50 pointer-events-none" : ""}>
          <Label className="text-sm font-medium">Or require it for specific roles</Label>
          <div className="grid sm:grid-cols-2 gap-2 mt-2">
            {ROLE_OPTIONS.map(r => (
              <label key={r.value} className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-muted/40">
                <Checkbox
                  checked={enforceRoles.includes(r.value)}
                  onCheckedChange={() => toggleRole(r.value)}
                />
                <span className="text-sm">{r.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate({ enforce2faAll: enforceAll, enforce2faRoles: enforceRoles })}
          >
            {save.isPending ? "Saving…" : "Save enforcement"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Security() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const { data: settings, isLoading: settingsLoading } = useQuery<SecuritySettings>({
    queryKey: ["security-settings"],
    enabled: isAdmin,
    queryFn: () =>
      apiFetch("/api/security/settings", { headers: authHeader() }).then(r =>
        r.ok ? r.json() : Promise.reject("Failed to load settings")
      ),
  });

  const { data: locked = [], isLoading: lockedLoading } = useQuery<LockedAccount[]>({
    queryKey: ["locked-accounts"],
    enabled: isAdmin,
    queryFn: () =>
      apiFetch("/api/security/locked-accounts", { headers: authHeader() }).then(r =>
        r.ok ? r.json() : Promise.reject("Failed to load locked accounts")
      ),
    refetchInterval: 30000,
  });

  const [form, setForm] = useState<{ lockoutEnabled: boolean; maxAttempts: number; lockoutDurationMinutes: number } | null>(null);

  const currentForm = form ?? (settings ? { lockoutEnabled: settings.lockoutEnabled, maxAttempts: settings.maxAttempts, lockoutDurationMinutes: settings.lockoutDurationMinutes } : null);

  const saveSettings = useMutation({
    mutationFn: (data: { lockoutEnabled: boolean; maxAttempts: number; lockoutDurationMinutes: number }) =>
      apiFetch("/api/security/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(data),
      }).then(r => r.ok ? r.json() : r.json().then((e: any) => Promise.reject(e.error))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-settings"] });
      setForm(null);
      toast({ title: "Settings saved", description: "Security settings updated successfully." });
    },
    onError: (e: any) => toast({ title: "Error", description: String(e), variant: "destructive" }),
  });

  const unlockAccount = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/security/unlock/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
      }).then(r => r.ok ? r.json() : r.json().then((e: any) => Promise.reject(e.error))),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["locked-accounts"] });
      toast({ title: "Account unlocked", description: `${data.name}'s account has been unlocked.` });
    },
    onError: (e: any) => toast({ title: "Error", description: String(e), variant: "destructive" }),
  });

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <PageHeader
        title="Security Settings"
        description={isAdmin
          ? "Manage your own two-factor authentication, configure lockout policies, and review locked accounts."
          : "Manage your own two-factor authentication."}
      />

      <PersonalTwoFactorCard />

      {isAdmin && (
        <>
          {settings && <Enforce2FACard settings={settings} />}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-500" />
                Account Lockout Policy
              </CardTitle>
              <CardDescription>
                Automatically lock accounts after a number of failed login attempts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {settingsLoading || !currentForm ? (
                <p className="text-sm text-muted-foreground">Loading settings…</p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="lockout-toggle" className="text-sm font-medium">Enable account lockout</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">Lock accounts after repeated failed login attempts</p>
                    </div>
                    <Switch
                      id="lockout-toggle"
                      checked={currentForm.lockoutEnabled}
                      onCheckedChange={v => setForm({ ...currentForm, lockoutEnabled: v })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="max-attempts" className="text-sm font-medium">Max failed attempts</Label>
                      <Input
                        id="max-attempts"
                        type="number"
                        min={1}
                        max={50}
                        value={currentForm.maxAttempts}
                        onChange={e => setForm({ ...currentForm, maxAttempts: parseInt(e.target.value) || 5 })}
                        disabled={!currentForm.lockoutEnabled}
                      />
                      <p className="text-xs text-muted-foreground">Account locks after this many failures</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lockout-duration" className="text-sm font-medium">Auto-unlock after (minutes)</Label>
                      <Input
                        id="lockout-duration"
                        type="number"
                        min={1}
                        value={currentForm.lockoutDurationMinutes}
                        onChange={e => setForm({ ...currentForm, lockoutDurationMinutes: parseInt(e.target.value) || 30 })}
                        disabled={!currentForm.lockoutEnabled}
                      />
                      <p className="text-xs text-muted-foreground">0 = manual unlock only</p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={() => saveSettings.mutate(currentForm)}
                      disabled={saveSettings.isPending}
                    >
                      {saveSettings.isPending ? "Saving…" : "Save Settings"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LockOpen className="h-5 w-5 text-red-500" />
                Locked Accounts
                {locked.length > 0 && (
                  <Badge variant="destructive" className="ml-2">{locked.length}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Accounts currently locked due to repeated failed login attempts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lockedLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : locked.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-muted-foreground gap-2">
                  <ShieldAlert className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No accounts are currently locked</p>
                </div>
              ) : (
                <div className="divide-y">
                  {locked.map(account => (
                    <div key={account.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center">
                          <User className="h-4 w-4 text-red-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{account.name}</p>
                          <p className="text-xs text-muted-foreground">{account.email}</p>
                          {account.lockedAt && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3" />
                              Locked {new Date(account.lockedAt).toLocaleString()}
                              &nbsp;·&nbsp;{account.failedLoginAttempts} failed attempt{account.failedLoginAttempts !== 1 ? "s" : ""}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => unlockAccount.mutate(account.id)}
                        disabled={unlockAccount.isPending}
                      >
                        <LockOpen className="h-4 w-4 mr-1" />
                        Unlock
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
