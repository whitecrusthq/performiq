import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button, Input, Label } from "@/components/shared";
import { AlertCircle, ShieldCheck, Smartphone, KeyRound, Copy, Check, Download } from "lucide-react";
import { apiFetch } from "@/lib/utils";
import { useAppSettings } from "@/hooks/use-app-settings";
import { BrandMark } from "@/components/brand-mark";

type Stage = "loading" | "scan" | "verify" | "backup" | "error";

export default function SetupTwoFactor() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { settings } = useAppSettings();
  const [stage, setStage] = useState<Stage>("loading");
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [acknowledgedBackup, setAcknowledgedBackup] = useState(false);

  const pendingToken = typeof window !== "undefined" ? sessionStorage.getItem("pending2FAToken") || "" : "";
  const email = typeof window !== "undefined" ? sessionStorage.getItem("pending2FAEmail") || "" : "";

  useEffect(() => {
    if (!pendingToken) {
      setLocation("/login");
      return;
    }
    (async () => {
      try {
        const r = await apiFetch("/api/auth/2fa/forced-setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pendingToken }),
        });
        const data = await r.json();
        if (!r.ok) {
          setError(data.error || "Could not start setup.");
          setStage("error");
          return;
        }
        setQrDataUrl(data.qrCodeDataUrl);
        setSecret(data.secret);
        setStage("scan");
      } catch {
        setError("Network error. Please try again.");
        setStage("error");
      }
    })();
  }, [pendingToken, setLocation]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const r = await apiFetch("/api/auth/2fa/forced-enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingToken, code }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || "Verification failed.");
        return;
      }
      setBackupCodes(data.backupCodes || []);
      sessionStorage.removeItem("pending2FAToken");
      sessionStorage.removeItem("pending2FAEmail");
      login(data.token, data.user);
      setStage("backup");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyBackupCodes = async () => {
    await navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const downloadBackupCodes = () => {
    const blob = new Blob([
      `${settings.companyName || "PerformIQ"} backup codes for ${email}\nGenerated ${new Date().toLocaleString()}\n\n` +
      backupCodes.join("\n") +
      `\n\nKeep these codes safe. Each code can only be used once.\n`
    ], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "performiq-backup-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-center mb-6">
          <div className="inline-block shadow-lg shadow-primary/20 rounded-2xl">
            <BrandMark
              logoUrl={settings.logoUrl}
              letter={settings.logoLetter}
              companyName={settings.companyName}
              size="md"
            />
          </div>
        </div>

        <div className="bg-card border rounded-2xl shadow-xl p-8 sm:p-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold font-display tracking-tight">Set up two-factor authentication</h1>
          </div>
          <p className="text-muted-foreground mb-6">
            Your administrator requires every user to secure their account with an authenticator app.
            This is a one-time setup for <span className="font-medium text-foreground">{email}</span>.
          </p>

          {error && (
            <div className="bg-destructive/10 border-l-4 border-destructive text-destructive p-4 rounded-r-xl mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {stage === "loading" && (
            <p className="text-sm text-muted-foreground py-12 text-center">Preparing your setup…</p>
          )}

          {stage === "error" && (
            <Button onClick={() => setLocation("/login")} className="mt-2">Back to sign in</Button>
          )}

          {(stage === "scan" || stage === "verify") && (
            <>
              <div className="grid sm:grid-cols-2 gap-6 mb-6">
                <div>
                  <h2 className="font-semibold mb-2 flex items-center gap-2"><Smartphone className="w-4 h-4" /> Step 1 — Scan</h2>
                  <p className="text-sm text-muted-foreground mb-3">
                    Open Google Authenticator, 1Password, Authy or similar and scan this code.
                  </p>
                  <div className="bg-white p-3 rounded-xl border w-fit">
                    {qrDataUrl ? <img src={qrDataUrl} alt="2FA QR code" className="w-44 h-44" /> : <div className="w-44 h-44 bg-muted animate-pulse rounded" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">Can't scan? Enter this key manually:</p>
                  <code className="block mt-1 text-xs font-mono break-all bg-muted px-2 py-1.5 rounded">{secret}</code>
                </div>

                <div>
                  <h2 className="font-semibold mb-2 flex items-center gap-2"><KeyRound className="w-4 h-4" /> Step 2 — Verify</h2>
                  <p className="text-sm text-muted-foreground mb-3">
                    Enter the 6-digit code currently shown in your authenticator app.
                  </p>
                  <form onSubmit={handleVerify} className="space-y-4">
                    <div>
                      <Label>Verification code</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        placeholder="000000"
                        value={code}
                        onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                        className="text-center text-2xl tracking-[0.5em] font-mono"
                        required
                        autoFocus
                      />
                    </div>
                    <Button type="submit" className="w-full" isLoading={submitting}>
                      Confirm &amp; Continue
                    </Button>
                  </form>
                </div>
              </div>
            </>
          )}

          {stage === "backup" && (
            <div>
              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 mb-5 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold">Save these backup codes now.</p>
                  <p>You'll see them only once. Each code lets you sign in once if you lose your authenticator app.</p>
                </div>
              </div>

              <div className="bg-muted/50 rounded-xl p-4 mb-4 grid grid-cols-2 gap-2 font-mono text-sm">
                {backupCodes.map((c, i) => (
                  <div key={i} className="bg-background px-3 py-2 rounded border">{c}</div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                <Button type="button" variant="outline" size="sm" onClick={copyBackupCodes}>
                  {copied ? <><Check className="w-4 h-4 mr-1.5" /> Copied</> : <><Copy className="w-4 h-4 mr-1.5" /> Copy all</>}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={downloadBackupCodes}>
                  <Download className="w-4 h-4 mr-1.5" /> Download .txt
                </Button>
              </div>

              <label className="flex items-start gap-2 text-sm text-muted-foreground mb-5 cursor-pointer">
                <input type="checkbox" className="mt-1" checked={acknowledgedBackup} onChange={e => setAcknowledgedBackup(e.target.checked)} />
                <span>I have saved my backup codes somewhere safe.</span>
              </label>

              <Button
                className="w-full"
                size="lg"
                disabled={!acknowledgedBackup}
                onClick={() => setLocation("/dashboard")}
              >
                Continue to dashboard
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
