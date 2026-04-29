import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLogin } from "../lib";
import { Button, Input, Label } from "@/components/shared";
import { AlertCircle, ShieldCheck, ArrowLeft, Smartphone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/utils";
import { useAppSettings } from "@/hooks/use-app-settings";
import { BrandMark } from "@/components/brand-mark";

type Step = "login" | "email-otp" | "totp";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<Step>("login");
  const [code, setCode] = useState("");
  const [pendingToken, setPendingToken] = useState<string>("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const loginMutation = useLogin();
  const { settings } = useAppSettings();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { data: { email, password } },
      {
        onSuccess: (data: any) => {
          if (data.requires2FASetup && data.pendingToken) {
            sessionStorage.setItem("pending2FAToken", data.pendingToken);
            sessionStorage.setItem("pending2FAEmail", data.email || email);
            setLocation("/setup-2fa");
            return;
          }
          if (data.requires2FA && data.pendingToken) {
            setPendingToken(data.pendingToken);
            setStep("totp");
            setCode("");
            setVerifyError(null);
            return;
          }
          if (data.status === "otp_required" || data.otpRequired) {
            setStep("email-otp");
            setCode("");
            setVerifyError(null);
            return;
          }
          login(data.token, data.user);
          setLocation("/dashboard");
        }
      }
    );
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
      login(data.token, data.user);
      setLocation("/dashboard");
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
    loginMutation.reset();
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

              {loginMutation.isError && (
                <div className="bg-destructive/10 border-l-4 border-destructive text-destructive p-4 rounded-r-xl mb-6 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">Invalid email or password. Please try again.</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <Label>Email address</Label>
                  <Input type="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="mb-0">Password</Label>
                  </div>
                  <Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full mt-8" size="lg" isLoading={loginMutation.isPending}>
                  Sign In
                </Button>
              </form>

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
