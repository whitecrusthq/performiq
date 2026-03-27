import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLogin } from "../lib";
import { Button, Input, Label } from "@/components/shared";
import { AlertCircle, ShieldCheck, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const loginMutation = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { data: { email, password } },
      {
        onSuccess: (data: any) => {
          if (data.status === "otp_required") {
            setOtpStep(true);
            setOtp("");
            setOtpError(null);
          } else {
            login(data.token, data.user);
            setLocation("/dashboard");
          }
        }
      }
    );
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);
    setOtpLoading(true);
    try {
      const r = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await r.json();
      if (!r.ok) {
        setOtpError(data.error || "Verification failed.");
        return;
      }
      login(data.token, data.user);
      setLocation("/dashboard");
    } catch {
      setOtpError("Network error. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  const leftPanel = (
    <div className="hidden lg:flex flex-1 relative bg-primary/5 items-center justify-center p-12 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-10 -left-20 w-80 h-80 bg-accent/50 rounded-full blur-3xl" />
      <div className="relative z-10 max-w-lg text-center">
        <div className="w-24 h-24 bg-gradient-to-br from-primary to-primary/80 rounded-3xl flex items-center justify-center text-primary-foreground font-bold text-5xl font-display shadow-2xl shadow-primary/30 mx-auto mb-8 transform -rotate-6">
          P
        </div>
        <h1 className="text-5xl font-display font-bold text-foreground mb-6 leading-tight">Elevate Your Team's Performance.</h1>
        <p className="text-xl text-muted-foreground">PerformIQ streamlines appraisals, goals, and feedback into one elegant platform.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full flex bg-background">
      {leftPanel}

      <div className="flex-1 flex flex-col justify-center px-4 sm:px-12 lg:px-24 xl:px-32">
        <AnimatePresence mode="wait">
          {!otpStep ? (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="w-full max-w-md mx-auto"
            >
              <div className="lg:hidden w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground font-bold text-3xl font-display shadow-lg shadow-primary/20 mb-8">P</div>

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

              <div className="mt-10 pt-8 border-t border-border/50 text-center">
                <p className="text-sm text-muted-foreground">Demo Accounts:</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <span className="px-3 py-1 bg-secondary rounded-full text-xs font-medium">admin@performiq.com</span>
                  <span className="px-3 py-1 bg-secondary rounded-full text-xs font-medium">johnme@performiq.com (Mgr)</span>
                  <span className="px-3 py-1 bg-secondary rounded-full text-xs font-medium">alice@performiq.com (Emp)</span>
                </div>
                <p className="text-xs text-muted-foreground mt-3">Password for all: <code className="bg-muted px-1.5 py-0.5 rounded">password</code></p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="otp"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="w-full max-w-md mx-auto"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <ShieldCheck className="w-8 h-8 text-primary" />
              </div>

              <h2 className="text-3xl font-bold font-display tracking-tight text-foreground mb-2 text-center">Check your email</h2>
              <p className="text-muted-foreground mb-8 text-center">
                We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>. Enter it below to sign in.
              </p>

              {otpError && (
                <div className="bg-destructive/10 border-l-4 border-destructive text-destructive p-4 rounded-r-xl mb-6 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{otpError}</p>
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div>
                  <Label>Verification code</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="000000"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                    className="text-center text-2xl tracking-[0.5em] font-mono"
                    required
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground mt-2 text-center">Code expires in 10 minutes.</p>
                </div>
                <Button type="submit" className="w-full" size="lg" isLoading={otpLoading}>
                  Verify &amp; Sign In
                </Button>
              </form>

              <button
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mt-6 mx-auto transition-colors"
                onClick={() => { setOtpStep(false); setOtpError(null); loginMutation.reset(); }}
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
