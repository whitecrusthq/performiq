import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { SiWhatsapp, SiFacebook, SiInstagram, SiMailgun } from "react-icons/si";
import { CheckCircle2, Bot, Trash2, Loader2, Eye, EyeOff, XCircle, Zap, Send, Globe, Palette, Upload, X, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost, apiPut, getBaseUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { applyBrandingToDOM, useBranding } from "@/lib/branding-context";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface EmailConfig {
  id: number;
  provider: string;
  hasApiKey: boolean;
  domain: string | null;
  region: "us" | "eu";
  fromEmail: string | null;
  fromName: string | null;
  isActive: boolean;
}

interface BrandingData {
  appName: string;
  primaryColor: string;
  sidebarColor: string;
  logoData: string | null;
  backgroundData: string | null;
}

interface ApiAgent { id: number; name: string; email: string; role: string; isActive: boolean; }

export default function Settings() {
  const { toast } = useToast();
  const { agent: currentAgent, logout } = useAuth();
  const { setBrandingData } = useBranding();
  const qc = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("agent");

  const { data: agents = [], isLoading } = useQuery<ApiAgent[]>({
    queryKey: ["agents"],
    queryFn: () => apiGet("/agents"),
  });

  const addAgentMutation = useMutation({
    mutationFn: (data: object) => apiPost("/agents", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      setIsAddOpen(false);
      setNewName(""); setNewEmail(""); setNewPassword(""); setNewRole("agent");
      toast({ title: "Agent added", description: "New agent has been created." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateAgentMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number; role?: string; isActive?: boolean }) =>
      apiPut(`/agents/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  // ── Branding state ─────────────────────────────────────────────────────────
  const [brandingName, setBrandingName] = useState("CommsCRM");
  const [brandingPrimary, setBrandingPrimary] = useState("#4F46E5");
  const [brandingSidebar, setBrandingSidebar] = useState("#3F0E40");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);

  useQuery<BrandingData>({
    queryKey: ["branding"],
    queryFn: () => apiGet("/branding"),
    onSuccess: (d: BrandingData) => {
      setBrandingName(d.appName ?? "CommsCRM");
      setBrandingPrimary(d.primaryColor ?? "#4F46E5");
      setBrandingSidebar(d.sidebarColor ?? "#3F0E40");
      setLogoPreview(d.logoData ?? null);
      setBgPreview(d.backgroundData ?? null);
    },
  } as Parameters<typeof useQuery>[0]);

  const saveBranding = async () => {
    setBrandingSaving(true);
    try {
      const token = localStorage.getItem("crm_token");
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/branding`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ appName: brandingName, primaryColor: brandingPrimary, sidebarColor: brandingSidebar }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const updated = { appName: brandingName, primaryColor: brandingPrimary, sidebarColor: brandingSidebar, logoData: logoPreview, backgroundData: bgPreview };
      applyBrandingToDOM(updated);
      setBrandingData(updated);
      toast({ title: "Appearance saved!", description: "Your branding changes are now live." });
    } catch {
      toast({ title: "Failed to save appearance", variant: "destructive" });
    } finally {
      setBrandingSaving(false);
    }
  };

  const uploadBrandingFile = async (file: File, type: "logo" | "background") => {
    const setter = type === "logo" ? setLogoUploading : setBgUploading;
    setter(true);
    try {
      const token = localStorage.getItem("crm_token");
      const baseUrl = getBaseUrl();
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${baseUrl}/branding/upload/${type}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json() as Record<string, string>;
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      if (type === "logo") {
        setLogoPreview(data.logoData ?? null);
        toast({ title: "Logo uploaded", description: "Your new logo is now showing in the sidebar." });
      } else {
        setBgPreview(data.backgroundData ?? null);
        toast({ title: "Background uploaded", description: "Background image applied to the app." });
      }
      const after = {
        appName: brandingName,
        primaryColor: brandingPrimary,
        sidebarColor: brandingSidebar,
        logoData: type === "logo" ? (data.logoData ?? null) : logoPreview,
        backgroundData: type === "background" ? (data.backgroundData ?? null) : bgPreview,
      };
      applyBrandingToDOM(after);
      setBrandingData(after);
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setter(false);
    }
  };

  const clearBrandingImage = async (type: "logo" | "background") => {
    try {
      const token = localStorage.getItem("crm_token");
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/branding`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(type === "logo" ? { clearLogo: true } : { clearBackground: true }),
      });
      if (!res.ok) throw new Error("Failed to clear");
      if (type === "logo") setLogoPreview(null);
      else setBgPreview(null);
      const after = {
        appName: brandingName,
        primaryColor: brandingPrimary,
        sidebarColor: brandingSidebar,
        logoData: type === "logo" ? null : logoPreview,
        backgroundData: type === "background" ? null : bgPreview,
      };
      applyBrandingToDOM(after);
      setBrandingData(after);
      toast({ title: type === "logo" ? "Logo removed" : "Background removed" });
    } catch {
      toast({ title: "Failed to clear image", variant: "destructive" });
    }
  };

  // ── Mailgun state ──────────────────────────────────────────────────────────
  const [mgApiKey, setMgApiKey] = useState("");
  const [mgDomain, setMgDomain] = useState("");
  const [mgRegion, setMgRegion] = useState<"us" | "eu">("us");
  const [mgFromEmail, setMgFromEmail] = useState("");
  const [mgFromName, setMgFromName] = useState("CommsCRM");
  const [mgActive, setMgActive] = useState(false);
  const [showMgKey, setShowMgKey] = useState(false);
  const [mgTestEmail, setMgTestEmail] = useState("");
  const [mgTesting, setMgTesting] = useState(false);
  const [mgValidating, setMgValidating] = useState(false);
  const [mgTestResult, setMgTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const { data: emailConfig, isLoading: emailLoading } = useQuery<EmailConfig>({
    queryKey: ["email-settings"],
    queryFn: () => apiGet("/settings/email"),
    onSuccess: (d) => {
      setMgDomain(d.domain ?? "");
      setMgRegion(d.region ?? "us");
      setMgFromEmail(d.fromEmail ?? "");
      setMgFromName(d.fromName ?? "CommsCRM");
      setMgActive(d.isActive ?? false);
    },
  } as Parameters<typeof useQuery>[0]);

  const saveEmailMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPut("/settings/email", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-settings"] });
      setMgTestResult(null);
      toast({ title: "Mailgun settings saved!", description: mgActive ? "Email broadcasting is now active." : "Settings saved. Toggle 'Active' to enable broadcasting." });
    },
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  const validateDomain = async () => {
    setMgValidating(true);
    setMgTestResult(null);
    try {
      const token = localStorage.getItem("crm_token");
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/settings/email/validate-domain`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ apiKey: mgApiKey || undefined, domain: mgDomain, region: mgRegion }),
      });
      const data = await res.json() as { ok: boolean; message: string };
      setMgTestResult(data);
    } catch {
      setMgTestResult({ ok: false, message: "Network error" });
    } finally {
      setMgValidating(false);
    }
  };

  const sendTestEmail = async () => {
    if (!mgTestEmail) { toast({ title: "Enter a test email address first", variant: "destructive" }); return; }
    setMgTesting(true);
    setMgTestResult(null);
    try {
      const token = localStorage.getItem("crm_token");
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/settings/email/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ testEmail: mgTestEmail, apiKey: mgApiKey || undefined, domain: mgDomain, region: mgRegion, fromEmail: mgFromEmail, fromName: mgFromName }),
      });
      const data = await res.json() as { ok: boolean; message: string };
      setMgTestResult(data);
    } catch {
      setMgTestResult({ ok: false, message: "Network error" });
    } finally {
      setMgTesting(false);
    }
  };

  const handleSave = () => {
    toast({ title: "Settings Saved", description: "Your configuration has been updated successfully." });
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your team, channels, and AI configuration.</p>
      </div>

      <div className="grid gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Connected Channels</CardTitle>
            <CardDescription>Manage the platforms CommsCRM is listening to.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-[#25D366]/10 flex items-center justify-center">
                  <SiWhatsapp className="h-5 w-5 text-[#25D366]" />
                </div>
                <div>
                  <h4 className="font-semibold">WhatsApp Business</h4>
                  <p className="text-sm text-muted-foreground">+1 (555) 019-2834</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                  <CheckCircle2 className="h-4 w-4" /> Connected
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-[#1877F2]/10 flex items-center justify-center">
                  <SiFacebook className="h-5 w-5 text-[#1877F2]" />
                </div>
                <div>
                  <h4 className="font-semibold">Facebook Messenger</h4>
                  <p className="text-sm text-muted-foreground">@HiraOfficial</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                  <CheckCircle2 className="h-4 w-4" /> Connected
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 border border-dashed rounded-lg bg-muted/20 opacity-70">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <SiInstagram className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h4 className="font-semibold">Instagram Direct</h4>
                  <p className="text-sm text-muted-foreground">Not connected</p>
                </div>
              </div>
              <Button variant="secondary" size="sm">Connect Account</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" /> AI & Automation
            </CardTitle>
            <CardDescription>Configure how the AI bot handles incoming messages.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">First-line Deflection Bot</Label>
                <p className="text-sm text-muted-foreground">Automatically attempt to resolve queries before routing to human agents.</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="space-y-4">
              <Label>Bot Personality Tone</Label>
              <Select defaultValue="professional">
                <SelectTrigger className="w-[300px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional & Direct</SelectItem>
                  <SelectItem value="friendly">Friendly & Casual</SelectItem>
                  <SelectItem value="empathetic">Empathetic & Supportive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-4">
              <Label>Auto-escalation Threshold</Label>
              <div className="text-sm text-muted-foreground mb-2">Escalate to human if sentiment score drops below:</div>
              <div className="flex items-center gap-4">
                <input type="range" min="1" max="100" defaultValue="40" className="w-[300px] accent-primary" />
                <span className="font-medium text-sm">40%</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t bg-muted/20 px-6 py-4">
            <Button onClick={handleSave} data-testid="button-save-ai-settings">Save Automation Settings</Button>
          </CardFooter>
        </Card>

        {/* Mailgun / Email Broadcasting Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#FF0010]/10 flex items-center justify-center">
                  <SiMailgun className="h-5 w-5 text-[#FF0010]" />
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Mailgun — Email Broadcasting
                    {emailConfig?.isActive ? (
                      <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>Connect Mailgun to send email campaigns to your customer list.</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Label className="text-sm text-muted-foreground">Enabled</Label>
                <Switch checked={mgActive} onCheckedChange={setMgActive} />
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {emailLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* API Key */}
                  <div className="sm:col-span-2">
                    <Label className="flex items-center gap-1.5 mb-1.5">
                      API Key
                      {emailConfig?.hasApiKey && <Badge variant="secondary" className="text-[10px] h-4">stored</Badge>}
                    </Label>
                    <div className="relative">
                      <Input
                        type={showMgKey ? "text" : "password"}
                        placeholder={emailConfig?.hasApiKey ? "••••••••• (leave blank to keep existing)" : "key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxx-xxxxxxxx"}
                        value={mgApiKey}
                        onChange={(e) => setMgApiKey(e.target.value)}
                        className="pr-10 font-mono text-sm"
                      />
                      <button onClick={() => setShowMgKey((v) => !v)} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
                        {showMgKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Find your API key at <span className="font-mono">app.mailgun.com → Account → API Keys</span>
                    </p>
                  </div>

                  {/* Domain */}
                  <div>
                    <Label className="mb-1.5 flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Sending Domain</Label>
                    <Input
                      placeholder="mg.yourdomain.com"
                      value={mgDomain}
                      onChange={(e) => setMgDomain(e.target.value)}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">The domain you configured in Mailgun</p>
                  </div>

                  {/* Region */}
                  <div>
                    <Label className="mb-1.5">Mailgun Region</Label>
                    <Select value={mgRegion} onValueChange={(v) => setMgRegion(v as "us" | "eu")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="us">🇺🇸 US (api.mailgun.net)</SelectItem>
                        <SelectItem value="eu">🇪🇺 EU (api.eu.mailgun.net)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* From Name */}
                  <div>
                    <Label className="mb-1.5">From Name</Label>
                    <Input
                      placeholder="CommsCRM"
                      value={mgFromName}
                      onChange={(e) => setMgFromName(e.target.value)}
                    />
                  </div>

                  {/* From Email */}
                  <div>
                    <Label className="mb-1.5">From Email</Label>
                    <Input
                      type="email"
                      placeholder="noreply@mg.yourdomain.com"
                      value={mgFromEmail}
                      onChange={(e) => setMgFromEmail(e.target.value)}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Must use your verified Mailgun domain</p>
                  </div>
                </div>

                <Separator />

                {/* Validate domain + test email */}
                <div>
                  <p className="text-sm font-medium mb-3">Test & Validate</p>
                  <div className="flex gap-3 flex-wrap items-end">
                    <div className="flex-1 min-w-48">
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Test recipient email</Label>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        value={mgTestEmail}
                        onChange={(e) => setMgTestEmail(e.target.value)}
                      />
                    </div>
                    <Button variant="outline" onClick={validateDomain} disabled={mgValidating || !mgDomain} className="gap-2">
                      {mgValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                      Validate Domain
                    </Button>
                    <Button variant="outline" onClick={sendTestEmail} disabled={mgTesting || !mgTestEmail} className="gap-2">
                      {mgTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Send Test Email
                    </Button>
                  </div>

                  {mgTestResult && (
                    <div className={`mt-3 p-3 rounded-lg border text-xs flex items-start gap-2 ${mgTestResult.ok ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/20 dark:border-green-900 dark:text-green-400" : "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900 dark:text-red-400"}`}>
                      {mgTestResult.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                      <span>{mgTestResult.message}</span>
                    </div>
                  )}
                </div>

                {/* How it works */}
                <div className="p-4 rounded-xl bg-muted/40 border text-xs text-muted-foreground space-y-1.5">
                  <p className="font-semibold text-foreground text-sm">How email broadcasting works</p>
                  <p>When you mark an <strong>email campaign</strong> as "Sent" in the Campaigns page, CommsCRM automatically sends it to all customers who have an email address on file via Mailgun.</p>
                  <p className="mt-1">Campaigns sent to other channels (WhatsApp, Facebook, etc.) are not affected by this setting.</p>
                </div>
              </>
            )}
          </CardContent>

          <CardFooter className="border-t bg-muted/20 px-6 py-4">
            <Button
              onClick={() => saveEmailMutation.mutate({ apiKey: mgApiKey || undefined, domain: mgDomain, region: mgRegion, fromEmail: mgFromEmail, fromName: mgFromName, isActive: mgActive })}
              disabled={saveEmailMutation.isPending}
              className="gap-2"
            >
              {saveEmailMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Mailgun Settings
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Team Management</CardTitle>
              <CardDescription>Add agents and manage their roles.</CardDescription>
            </div>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-agent">Add Agent</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add New Agent</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2"><Label>Full Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Sarah Mitchell" /></div>
                  <div className="space-y-2"><Label>Email Address</Label><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="sarah@hiracrm.com" /></div>
                  <div className="space-y-2"><Label>Initial Password</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimum 8 characters" /></div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={newRole} onValueChange={setNewRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                        <SelectItem value="agent">Agent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                  <Button disabled={!newName || !newEmail || !newPassword || addAgentMutation.isPending} onClick={() => addAgentMutation.mutate({ name: newName, email: newEmail, password: newPassword, role: newRole })}>
                    {addAgentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Agent"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-4">
                {agents.map((agent) => (
                  <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border" data-testid={`agent-row-${agent.id}`}>
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarFallback>{agent.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{agent.name} {agent.id === currentAgent?.id && <span className="text-xs text-muted-foreground">(you)</span>}</div>
                        <div className="text-sm text-muted-foreground">{agent.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Select defaultValue={agent.role} onValueChange={(val) => updateAgentMutation.mutate({ id: agent.id, role: val })}>
                        <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="supervisor">Supervisor</SelectItem>
                          <SelectItem value="agent">Agent</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" disabled={agent.id === currentAgent?.id}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {currentAgent?.role === "admin" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" /> Appearance
              </CardTitle>
              <CardDescription>Customize your app's name, colors, logo, and background image.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* App Name */}
              <div className="space-y-2">
                <Label>App Name</Label>
                <Input
                  value={brandingName}
                  onChange={(e) => setBrandingName(e.target.value)}
                  placeholder="CommsCRM"
                  maxLength={100}
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">Displayed in the sidebar header and browser title.</p>
              </div>

              <Separator />

              {/* Color Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input
                        type="color"
                        value={brandingPrimary}
                        onChange={(e) => setBrandingPrimary(e.target.value)}
                        className="h-10 w-10 rounded-md border cursor-pointer p-0.5 bg-transparent"
                        title="Pick primary color"
                      />
                    </div>
                    <Input
                      value={brandingPrimary}
                      onChange={(e) => {
                        if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setBrandingPrimary(e.target.value);
                      }}
                      className="font-mono text-sm w-32"
                      maxLength={7}
                    />
                    <div className="h-10 w-10 rounded-md border" style={{ backgroundColor: brandingPrimary }} />
                  </div>
                  <p className="text-xs text-muted-foreground">Buttons, links, badges, and accents.</p>
                </div>

                <div className="space-y-2">
                  <Label>Sidebar Color</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={brandingSidebar}
                      onChange={(e) => setBrandingSidebar(e.target.value)}
                      className="h-10 w-10 rounded-md border cursor-pointer p-0.5 bg-transparent"
                      title="Pick sidebar color"
                    />
                    <Input
                      value={brandingSidebar}
                      onChange={(e) => {
                        if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setBrandingSidebar(e.target.value);
                      }}
                      className="font-mono text-sm w-32"
                      maxLength={7}
                    />
                    <div className="h-10 w-10 rounded-md border" style={{ backgroundColor: brandingSidebar }} />
                  </div>
                  <p className="text-xs text-muted-foreground">The left navigation sidebar background.</p>
                </div>
              </div>

              <Separator />

              {/* Logo Upload */}
              <div className="space-y-3">
                <Label>Logo</Label>
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 rounded-xl border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="h-full w-full object-contain p-1" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          className="hidden"
                          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadBrandingFile(file, "logo");
                            e.target.value = "";
                          }}
                        />
                        <Button variant="outline" size="sm" className="gap-2 pointer-events-none" disabled={logoUploading}>
                          {logoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          Upload Logo
                        </Button>
                      </label>
                      {logoPreview && (
                        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-destructive" onClick={() => clearBrandingImage("logo")}>
                          <X className="h-4 w-4" /> Remove
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">PNG, SVG, or JPG. Max 8MB. Shown in the sidebar header.</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Background Image Upload */}
              <div className="space-y-3">
                <Label>Background Image</Label>
                <div className="flex items-start gap-4">
                  <div className="h-16 w-24 rounded-xl border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {bgPreview ? (
                      <img src={bgPreview} alt="Background" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          className="hidden"
                          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadBrandingFile(file, "background");
                            e.target.value = "";
                          }}
                        />
                        <Button variant="outline" size="sm" className="gap-2 pointer-events-none" disabled={bgUploading}>
                          {bgUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          Upload Background
                        </Button>
                      </label>
                      {bgPreview && (
                        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-destructive" onClick={() => clearBrandingImage("background")}>
                          <X className="h-4 w-4" /> Remove
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">PNG or JPG. Max 8MB. Applied as a full-screen background behind the app.</p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t bg-muted/20 px-6 py-4 flex gap-3">
              <Button onClick={saveBranding} disabled={brandingSaving} className="gap-2" data-testid="button-save-appearance">
                {brandingSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Palette className="h-4 w-4" />}
                Save Appearance
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBrandingName("CommsCRM");
                  setBrandingPrimary("#4F46E5");
                  setBrandingSidebar("#3F0E40");
                }}
                className="text-muted-foreground"
              >
                Reset to Defaults
              </Button>
            </CardFooter>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={logout} data-testid="button-logout">Sign out</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
