import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { LockOpen, ShieldAlert, User, Clock } from "lucide-react";

function authHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface SecuritySettings {
  id: number;
  lockoutEnabled: boolean;
  maxAttempts: number;
  lockoutDurationMinutes: number;
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

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        You do not have permission to view this page.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <PageHeader
        title="Security Settings"
        description="Configure account lockout policies and manage locked accounts."
      />

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
    </div>
  );
}
