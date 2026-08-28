import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { defaultLandingPath } from "@/lib/menu-permissions";
import { useAuth } from "@/hooks/use-auth";
import { useLogin } from "../lib";
import { Button, Input, PasswordInput, Label } from "@/components/shared";
import { AlertCircle, ShieldCheck, ArrowLeft, Smartphone, ScrollText, ExternalLink, KeyRound, Clock3, ShieldAlert } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/utils";
import { useAppSettings } from "@/hooks/use-app-settings";
import { BrandMark } from "@/components/brand-mark";

type Step = "login" | "email-otp" | "totp" | "terms" | "forgot-request" | "forgot-complete" | "temporary-password" | "recovery-pending";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<Step>("login");
  const [code, setCode] = useState("");
  const [pendingToken, setPendingToken] = useState<string>("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [termsVersion, setTermsVersion] = useState<number>(0);
  const [termsContent, setTermsContent] = useState<string>("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const loginMutation = useLogin();
  const { settings } = useAppSettings();
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryStatus, setRecoveryStatus] = useState("pending");
  const [recoveryExpiresAt, setRecoveryExpiresAt] = useState<string>("");
  const [reportingRecovery, setReportingRecovery] = useState(false);

  useEffect(() => {
    const n = sessionStorage.getItem("authNotice");
    if (n) {
      setAuthNotice(n);
      sessionStorage.removeItem("authNotice");
    }
  }, []);

  // Fetch the published terms so the user can read them inline on the gate.
  const loadTermsContent = async () => {
    try {
      const r = await apiFetch("/api/legal/terms");
      const data = await r.json();
      if (data.published) setTermsContent(data.content ?? "");
    } catch {
      /* The full page link still works even if inline preview fails. */
    }
  };

  // Returns true when a follow-up step (2FA / OTP / terms) was triggered and the
  // caller should stop. Returns false when the response is a final session.
  const handleAuthResponse = (data: any): boolean => {
    if (data.recoveryPending && data.pendingToken) {
      setPendingToken(data.pendingToken);
      setRecoveryStatus(data.status || "pending");
      setRecoveryExpiresAt(data.expiresAt || "");
      setVerifyError(null);
      setStep("recovery-pending");
      return true;
    }
    if (data.requiresPasswordChange && data.pendingToken) {
      setPendingToken(data.pendingToken);
      setEmail(data.email || email);
      setNewPassword("");
      setConfirmPassword("");
      setVerifyError(null);
      setStep("temporary-password");
      return true;
    }
    if (data.requires2FASetup && data.pendingToken) {
      sessionStorage.setItem("pending2FAToken", data.pendingToken);
      sessionStorage.setItem("pending2FAEmail", data.email || email);
      setLocation("/setup-2fa");
      return true;
    }
    if (data.requires2FA && data.pendingToken) {
      setPendingToken(data.pendingToken);
      setStep("totp");
      setCode("");
      setVerifyError(null);
      return true;
    }
    if (data.status === "otp_required" || data.otpRequired) {
      setStep("email-otp");
      setCode("");
      setVerifyError(null);
      return true;
    }
    if (data.requiresTermsAcceptance && data.pendingToken) {
      setPendingToken(data.pendingToken);
      setTermsVersion(data.termsVersion ?? 0);
      setTermsAccepted(false);
      setTermsContent("");
      setVerifyError(null);
      setStep("terms");
      loadTermsContent();
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (step !== "recovery-pending" || !pendingToken || recoveryStatus !== "pending") return;
    let active = true;
    const checkStatus = async () => {
      try {
        const response = await apiFetch("/api/auth/recovery-status", {
          headers: { Authorization: `Bearer ${pendingToken}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!active) return;
        if (!response.ok) {
          setVerifyError(data.error || "Unable to check the recovery request.");
          return;
        }
        setVerifyError(null);
        setRecoveryStatus(data.status || "pending");
        if (data.expiresAt) setRecoveryExpiresAt(data.expiresAt);
      } catch {
        if (active) setVerifyError("Unable to refresh the request status. We’ll try again shortly.");
      }
    };
    checkStatus();
    const timer = window.setInterval(checkStatus, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [step, pendingToken, recoveryStatus]);

  const reportRecovery = async () => {
    if (!pendingToken || !confirm("Report this recovery request as fraudulent? The request will be cancelled.")) return;
    setReportingRecovery(true);
    setVerifyError(null);
    try {
      const response = await apiFetch("/api/auth/recovery-report", {
        method: "POST",
        headers: { Authorization: `Bearer ${pendingToken}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to report this request.");
      setRecoveryStatus(data.status || "reported");
    } catch (error: any) {
      setVerifyError(error.message || "Network error. Please try again.");
    } finally {
      setReportingRecovery(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { data: { email, password } },
      {
        onSuccess: (data: any) => {
          if (handleAuthResponse(data)) return;
          login(data.token, data.user);
          setLocation(defaultLandingPath(data.user));
        }
      }
    );
  };

  const handleAcceptTerms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) return;
    setVerifyError(null);
    setVerifyLoading(true);
    try {
      const r = await apiFetch("/api/auth/terms/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingToken }),
      });
      const data = await r.json();
      if (!r.ok) {
        setVerifyError(data.error || "Could not record your acceptance. Please sign in again.");
        return;
      }
      if (handleAuthResponse(data)) return;
      login(data.token, data.user);
      setLocation(defaultLandingPath(data.user));
    } catch {
      setVerifyError("Network error. Please try again.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError(null);
    setVerifyLoading(true);
    try {
      const url = step === "totp" ? "/api/auth/2fa/verify" : "/api/auth/verify-otp";
      const body = step === "totp" ? { pendingToken, code } : { email, otp: code };
      const r = await apiFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) {
        setVerifyError(data.error || "Verification failed.");
        return;
      }
      if (handleAuthResponse(data)) return;
      login(data.token, data.user);
      setLocation(defaultLandingPath(data.user));
    } catch {
      setVerifyError("Network error. Please try again.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const goBack = () => {
    setStep("login");
    setVerifyError(null);
    setCode("");
    setPendingToken("");
    setTermsAccepted(false);
    setTermsContent("");
    setNewPassword("");
    setConfirmPassword("");
    setRecoveryStatus("pending");
    setRecoveryExpiresAt("");
    loginMutation.reset();
  };

  const requestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError(null);
    setVerifyLoading(true);
    try {
      const r = await apiFetch("/api/auth/password-reset/request", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || "Unable to send a reset code.");
      }
      setStep("forgot-complete");
      setCode("");
    } catch (err: any) {
      setVerifyError(err.message || "Network error. Please try again.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const completePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) return setVerifyError("Your new password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return setVerifyError("Passwords do not match.");
    setVerifyError(null);
    setVerifyLoading(true);
    try {
      const r = await apiFetch("/api/auth/password-reset/complete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Unable to reset password.");
      if (handleAuthResponse(data)) return;
      setAuthNotice("password_reset");
      goBack();
    } catch (err: any) {
      setVerifyError(err.message || "Network error. Please try again.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const changeTemporaryPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) return setVerifyError("Your new password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return setVerifyError("Passwords do not match.");
    setVerifyError(null);
    setVerifyLoading(true);
    try {
      const r = await apiFetch("/api/auth/temporary-password/change", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingToken, newPassword }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Unable to change password.");
      if (handleAuthResponse(data)) return;
      setAuthNotice("temporary_password_changed");
      goBack();
    } catch (err: any) {
      setVerifyError(err.message || "Network error. Please try again.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const leftPanel = (
    <div className="hidden lg:flex flex-1 relative bg-primary/5 items-center justify-center p-12 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-10 -left-20 w-80 h-80 bg-accent/50 rounded-full blur-3xl" />
      <div className="relative z-10 max-w-lg text-center">
        <div className="mx-auto mb-8 transform -rotate-6 inline-block shadow-2xl shadow-primary/30 rounded-3xl">
          <BrandMark
            logoUrl={settings.logoUrl}
            letter={settings.logoLetter}
            companyName={settings.companyName}
            size="xl"
          />
        </div>
        <h1 className="text-5xl font-display font-bold text-foreground mb-6 leading-tight whitespace-pre-line">{settings.loginHeadline}</h1>
        <p className="text-xl text-muted-foreground whitespace-pre-line">{settings.loginSubtext}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full flex bg-background">
      {leftPanel}

      <div className="flex-1 flex flex-col justify-center px-4 sm:px-12 lg:px-24 xl:px-32">
        <AnimatePresence mode="wait">
          {step === "login" ? (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="w-full max-w-md mx-auto"
            >
              <div className="lg:hidden mb-8 inline-block shadow-lg shadow-primary/20 rounded-2xl">
                <BrandMark
                  logoUrl={settings.logoUrl}
                  letter={settings.logoLetter}
                  companyName={settings.companyName}
                  size="lg"
                />
              </div>

              <h2 className="text-3xl font-bold font-display tracking-tight text-foreground mb-2">Welcome back</h2>
              <p className="text-muted-foreground mb-8">Please enter your details to sign in.</p>

              {authNotice && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-400 text-amber-900 dark:text-amber-200 p-4 rounded-r-xl mb-6 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium min-w-0 flex-1">
                    {authNotice === "session_replaced"
                      ? "You were signed out because your account was used to sign in elsewhere."
                      : authNotice === "idle_timeout"
                      ? "You were signed out after 30 minutes of inactivity. Please sign in again."
                      : authNotice === "password_reset"
                      ? "Your password has been reset. An administrator must approve your recovery request before you can sign in."
                      : authNotice === "temporary_password_changed"
                      ? "Your password has been changed. Sign in with your new password."
                      : "Your session has expired. Please sign in again."}
                  </p>
                </div>
              )}

              {loginMutation.isError && (() => {
                const err = loginMutation.error as any;
                const serverMsg =
                  err?.data?.error ||
                  err?.data?.detail ||
                  err?.data?.message ||
                  "Invalid email or password. Please try again.";
                return (
                  <div className="bg-destructive/10 border-l-4 border-destructive text-destructive p-4 rounded-r-xl mb-6 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium min-w-0 flex-1">{serverMsg}</p>
                  </div>
                );
              })()}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <Label>Email address</Label>
                  <Input type="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="mb-0">Password</Label>
                    <button type="button" onClick={() => { setVerifyError(null); setStep("forgot-request"); }} className="text-sm text-primary hover:underline">
                      Forgot password?
                    </button>
                  </div>
                  <PasswordInput placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full mt-8" size="lg" isLoading={loginMutation.isPending}>
                  Sign In
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-8">
                <Link href="/privacy" className="hover:text-foreground transition-colors underline underline-offset-2">
                  Privacy Policy
                </Link>
              </p>

            </motion.div>
          ) : step === "recovery-pending" ? (
            <motion.div
              key="recovery-pending"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="w-full max-w-md mx-auto"
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${
                recoveryStatus === "approved" ? "bg-emerald-100 dark:bg-emerald-950/40" :
                recoveryStatus === "pending" ? "bg-amber-100 dark:bg-amber-950/40" : "bg-destructive/10"
              }`}>
                {recoveryStatus === "approved"
                  ? <ShieldCheck className="w-8 h-8 text-emerald-600" />
                  : recoveryStatus === "pending"
                  ? <Clock3 className="w-8 h-8 text-amber-600" />
                  : <ShieldAlert className="w-8 h-8 text-destructive" />}
              </div>
              <h2 className="text-3xl font-bold font-display tracking-tight text-foreground mb-2 text-center">
                {recoveryStatus === "approved" ? "Recovery approved" :
                 recoveryStatus === "pending" ? "Approval pending" :
                 recoveryStatus === "expired" ? "Request expired" :
                 recoveryStatus === "reported" || recoveryStatus === "cancelled" ? "Request cancelled" :
                 "Recovery not approved"}
              </h2>
              <p className="text-muted-foreground mb-6 text-center" aria-live="polite">
                {recoveryStatus === "approved"
                  ? "Your request was approved. Return to sign in and start a fresh sign-in—this page will not sign you in automatically."
                  : recoveryStatus === "pending"
                  ? "An administrator must review your recovery request. This page will update automatically."
                  : recoveryStatus === "expired"
                  ? "This recovery request has expired. Return to sign in to start again."
                  : recoveryStatus === "reported" || recoveryStatus === "cancelled"
                  ? "The recovery request was reported and cancelled."
                  : "This recovery request was not approved. Return to sign in if you need further help."}
              </p>

              {recoveryExpiresAt && (
                <div className="rounded-xl border border-border bg-muted/30 p-4 mb-6 text-center">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Request expires</p>
                  <p className="font-semibold mt-1">
                    {Number.isNaN(new Date(recoveryExpiresAt).getTime()) ? recoveryExpiresAt : new Date(recoveryExpiresAt).toLocaleString()}
                  </p>
                </div>
              )}

              {verifyError && (
                <div className="bg-destructive/10 border-l-4 border-destructive text-destructive p-4 rounded-r-xl mb-6 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{verifyError}</p>
                </div>
              )}

              {recoveryStatus === "pending" && (
                <Button type="button" variant="destructive" className="w-full" size="lg" isLoading={reportingRecovery} onClick={reportRecovery}>
                  Report as fraudulent
                </Button>
              )}
              <button
                type="button"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mt-6 mx-auto transition-colors"
                onClick={goBack}
              >
                <ArrowLeft className="w-4 h-4" /> Sign out and back to sign in
              </button>
            </motion.div>
          ) : step === "terms" ? (
            <motion.div
              key="terms"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="w-full max-w-md mx-auto"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <ScrollText className="w-8 h-8 text-primary" />
              </div>

              <h2 className="text-3xl font-bold font-display tracking-tight text-foreground mb-2 text-center">
                Terms &amp; Conditions
              </h2>
              <p className="text-muted-foreground mb-6 text-center">
                Please review and accept our Terms &amp; Conditions{termsVersion ? <> (version {termsVersion})</> : null} to continue.
              </p>

              {verifyError && (
                <div className="bg-destructive/10 border-l-4 border-destructive text-destructive p-4 rounded-r-xl mb-6 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{verifyError}</p>
                </div>
              )}

              <div className="rounded-xl border border-border bg-muted/30 p-4 max-h-64 overflow-y-auto mb-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {termsContent || "Loading the latest terms…"}
              </div>

              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mb-5"
              >
                Open full Terms &amp; Conditions page <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <form onSubmit={handleAcceptTerms} className="space-y-5">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <Checkbox
                    checked={termsAccepted}
                    onCheckedChange={(v) => setTermsAccepted(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-sm text-foreground">
                    I have read and agree to the Terms &amp; Conditions.
                  </span>
                </label>
                <Button type="submit" className="w-full" size="lg" isLoading={verifyLoading} disabled={!termsAccepted}>
                  Accept &amp; Continue
                </Button>
              </form>

              <button
                type="button"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mt-6 mx-auto transition-colors"
                onClick={goBack}
              >
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </button>
            </motion.div>
          ) : step === "forgot-request" ? (
            <motion.div key="forgot-request" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.35 }} className="w-full max-w-md mx-auto">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6"><KeyRound className="w-8 h-8 text-primary" /></div>
              <h2 className="text-3xl font-bold font-display tracking-tight text-foreground mb-2 text-center">Reset your password</h2>
              <p className="text-muted-foreground mb-8 text-center">Enter your email and we’ll send a password reset code if the account is eligible.</p>
              {verifyError && <div className="bg-destructive/10 border-l-4 border-destructive text-destructive p-4 rounded-r-xl mb-6 flex gap-3"><AlertCircle className="w-5 h-5 shrink-0" /><p className="text-sm font-medium">{verifyError}</p></div>}
              <form onSubmit={requestPasswordReset} className="space-y-5"><div><Label>Email address</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" required autoFocus /></div><Button type="submit" className="w-full" size="lg" isLoading={verifyLoading}>Send reset code</Button></form>
              <button type="button" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mt-6 mx-auto transition-colors" onClick={goBack}><ArrowLeft className="w-4 h-4" /> Back to sign in</button>
            </motion.div>
          ) : step === "forgot-complete" || step === "temporary-password" ? (
            <motion.div key={step} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.35 }} className="w-full max-w-md mx-auto">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6"><KeyRound className="w-8 h-8 text-primary" /></div>
              <h2 className="text-3xl font-bold font-display tracking-tight text-foreground mb-2 text-center">{step === "temporary-password" ? "Choose a new password" : "Enter your reset code"}</h2>
              <p className="text-muted-foreground mb-8 text-center">{step === "temporary-password" ? "Your temporary password must be changed before you can sign in." : <>If an eligible account uses <span className="font-medium text-foreground">{email}</span>, a reset code has been sent. Enter it below with your new password.</>}</p>
              {verifyError && <div className="bg-destructive/10 border-l-4 border-destructive text-destructive p-4 rounded-r-xl mb-6 flex gap-3"><AlertCircle className="w-5 h-5 shrink-0" /><p className="text-sm font-medium">{verifyError}</p></div>}
              <form onSubmit={step === "temporary-password" ? changeTemporaryPassword : completePasswordReset} className="space-y-5">
                {step === "forgot-complete" && <div><Label>Reset code</Label><Input inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} className="text-center text-2xl tracking-[0.4em] font-mono" placeholder="000000" required autoFocus /></div>}
                <div><Label>New password</Label><PasswordInput value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} required /></div>
                <div><Label>Confirm new password</Label><PasswordInput value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={8} required /></div>
                <Button type="submit" className="w-full" size="lg" isLoading={verifyLoading}>{step === "temporary-password" ? "Change password" : "Reset password"}</Button>
              </form>
              {step === "forgot-complete" && <button type="button" disabled={verifyLoading} onClick={requestPasswordReset as any} className="block text-sm text-primary hover:underline mt-5 mx-auto disabled:opacity-50">Resend code</button>}
              <button type="button" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mt-4 mx-auto transition-colors" onClick={goBack}><ArrowLeft className="w-4 h-4" /> Back to sign in</button>
            </motion.div>
          ) : (
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="w-full max-w-md mx-auto"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                {step === "totp"
                  ? <Smartphone className="w-8 h-8 text-primary" />
                  : <ShieldCheck className="w-8 h-8 text-primary" />}
              </div>

              <h2 className="text-3xl font-bold font-display tracking-tight text-foreground mb-2 text-center">
                {step === "totp" ? "Authenticator code" : "Check your email"}
              </h2>
              <p className="text-muted-foreground mb-8 text-center">
                {step === "totp"
                  ? <>Open your authenticator app and enter the 6-digit code for <span className="font-medium text-foreground">{email}</span>. You can also use a backup code.</>
                  : <>We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>. Enter it below to sign in.</>}
              </p>

              {verifyError && (
                <div className="bg-destructive/10 border-l-4 border-destructive text-destructive p-4 rounded-r-xl mb-6 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{verifyError}</p>
                </div>
              )}

              <form onSubmit={handleVerify} className="space-y-5">
                <div>
                  <Label>{step === "totp" ? "Code or backup code" : "Verification code"}</Label>
                  <Input
                    type="text"
                    inputMode={step === "totp" ? "text" : "numeric"}
                    maxLength={step === "totp" ? 12 : 6}
                    placeholder={step === "totp" ? "000000" : "000000"}
                    value={code}
                    onChange={e => setCode(step === "totp" ? e.target.value.replace(/\s/g, "").toUpperCase() : e.target.value.replace(/\D/g, ""))}
                    className="text-center text-2xl tracking-[0.4em] font-mono"
                    required
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {step === "totp" ? "Codes refresh every 30 seconds." : "Code expires in 10 minutes."}
                  </p>
                </div>
                <Button type="submit" className="w-full" size="lg" isLoading={verifyLoading}>
                  Verify &amp; Sign In
                </Button>
              </form>

              <button
                type="button"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mt-6 mx-auto transition-colors"
                onClick={goBack}
              >
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
