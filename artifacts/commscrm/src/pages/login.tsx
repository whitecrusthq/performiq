import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiPost } from "@/lib/api";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Loader2, ShieldCheck, ArrowLeft } from "lucide-react";

interface LoginResponse {
  token: string;
  agent: { id: number; name: string; email: string; role: string; avatar: string | null };
}

interface LoginChallengeResponse {
  requires2FA: true;
  partialToken: string;
}

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  // Step 1: credentials
  const [email, setEmail] = useState("sarah@commscrm.com");
  const [password, setPassword] = useState("password");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 2: 2FA
  const [step, setStep] = useState<"credentials" | "2fa">("credentials");
  const [partialToken, setPartialToken] = useState("");
  const [twoFaCode, setTwoFaCode] = useState("");
  const [is2FaLoading, setIs2FaLoading] = useState(false);
  const [twoFaError, setTwoFaError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const data = await apiPost<LoginResponse | LoginChallengeResponse>("/auth/login", { email, password });
      if ("requires2FA" in data && data.requires2FA) {
        setPartialToken(data.partialToken);
        setTwoFaCode("");
        setTwoFaError("");
        setStep("2fa");
      } else {
        const resp = data as LoginResponse;
        login(resp.token, resp.agent);
        setLocation("/");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTwoFaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTwoFaError("");
    setIs2FaLoading(true);
    try {
      const data = await apiPost<LoginResponse>("/auth/2fa/complete", { partialToken, code: twoFaCode.trim() });
      login(data.token, data.agent);
      setLocation("/");
    } catch (err: unknown) {
      setTwoFaError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setIs2FaLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold tracking-tight">CommsCRM</span>
          </div>
          <p className="text-muted-foreground text-sm">Customer Service Command Centre</p>
        </div>

        {step === "credentials" ? (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Sign in to your account</CardTitle>
              <CardDescription>Enter your agent credentials to access the dashboard</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="agent@commscrm.com"
                    required
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    data-testid="input-password"
                  />
                </div>

                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-login">
                  {isLoading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in...</>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>

              <div className="mt-4 p-3 bg-muted/50 rounded-md text-xs text-muted-foreground">
                <p className="font-medium mb-1">Demo credentials:</p>
                <p>Email: sarah@commscrm.com</p>
                <p>Password: password</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Two-Factor Authentication</CardTitle>
                  <CardDescription>Enter the 6-digit code from your authenticator app</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTwoFaSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="totp-code">Authenticator code</Label>
                  <Input
                    id="totp-code"
                    value={twoFaCode}
                    onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="font-mono text-center text-xl tracking-[0.4em]"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    data-testid="input-totp"
                  />
                  <p className="text-xs text-muted-foreground">Open your authenticator app (Google Authenticator, Authy, etc.) and enter the current code.</p>
                </div>

                {twoFaError && (
                  <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    {twoFaError}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={twoFaCode.length !== 6 || is2FaLoading}
                  data-testid="button-verify-2fa"
                >
                  {is2FaLoading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying...</>
                  ) : (
                    "Verify & Sign In"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full gap-2"
                  onClick={() => { setStep("credentials"); setTwoFaCode(""); setTwoFaError(""); setPartialToken(""); }}
                >
                  <ArrowLeft className="h-4 w-4" /> Back to login
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
