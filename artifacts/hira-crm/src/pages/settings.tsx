import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { SiWhatsapp, SiFacebook, SiInstagram, SiMailgun } from "react-icons/si";
import {
  CheckCircle2, Bot, Trash2, Loader2, Eye, EyeOff, XCircle, Zap, Send,
  Globe, Palette, Upload, X, Image as ImageIcon, Wifi, Settings2, Users,
  Mail, ChevronRight, DatabaseZap, Play, RefreshCw, Archive, MessageSquare,
  AlertTriangle, CalendarClock, Plus, Pencil, ToggleLeft, ToggleRight,
  ShoppingCart, Bell, Package, Tag, UserCheck, Sparkles, Clock, ChevronDown,
  Filter, FileText, MessageCircle, ThumbsUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost, apiPut, apiDelete, getBaseUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { applyBrandingToDOM, useBranding } from "@/lib/branding-context";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

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

type SettingsSection = "channels" | "automation" | "email" | "team" | "appearance" | "retention" | "followups";

interface NavItem {
  id: SettingsSection;
  label: string;
  description: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: "channels",    label: "Channels",        description: "Connected platforms",   icon: Wifi },
  { id: "automation",  label: "AI & Automation", description: "Bot & escalation",      icon: Bot },
  { id: "email",       label: "Email",           description: "Mailgun broadcasting",  icon: Mail },
  { id: "followups",   label: "Follow-ups",      description: "Automation rules",      icon: CalendarClock },
  { id: "team",        label: "Team",            description: "Agents & roles",        icon: Users },
  { id: "appearance",  label: "Appearance",      description: "Branding & colors",     icon: Palette, adminOnly: true },
  { id: "retention",   label: "Data Retention",  description: "Transcript storage",    icon: DatabaseZap, adminOnly: true },
];

export default function Settings() {
  const { toast } = useToast();
  const { agent: currentAgent } = useAuth();
  const { setBrandingData } = useBranding();
  const qc = useQueryClient();

  const [activeSection, setActiveSection] = useState<SettingsSection>("channels");

  // ── Team state ─────────────────────────────────────────────────────────────
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
        appName: brandingName, primaryColor: brandingPrimary, sidebarColor: brandingSidebar,
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
        appName: brandingName, primaryColor: brandingPrimary, sidebarColor: brandingSidebar,
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

  const visibleNav = NAV_ITEMS.filter((item) =>
    !item.adminOnly || currentAgent?.role === "admin" || currentAgent?.role === "super_admin"
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left sidebar nav ───────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 border-r bg-muted/20 flex flex-col overflow-y-auto">
        <div className="px-5 py-5 border-b">
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Settings
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage your workspace</p>
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
                data-testid={`settings-nav-${item.id}`}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium leading-tight", isActive ? "text-primary-foreground" : "")}>{item.label}</p>
                  <p className={cn("text-[11px] truncate mt-0.5 leading-tight", isActive ? "text-primary-foreground/70" : "text-muted-foreground")}>{item.description}</p>
                </div>
                {isActive && <ChevronRight className="h-3.5 w-3.5 text-primary-foreground/70 shrink-0" />}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── Right content area ─────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-3xl space-y-6">

          {/* ── CHANNELS ───────────────────────────────────────────────────── */}
          {activeSection === "channels" && (
            <>
              <div>
                <h2 className="text-xl font-bold">Connected Channels</h2>
                <p className="text-sm text-muted-foreground mt-1">Manage the platforms CommsCRM is listening to.</p>
              </div>
              <Card>
                <CardContent className="pt-6 space-y-4">
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
            </>
          )}

          {/* ── AI & AUTOMATION ────────────────────────────────────────────── */}
          {activeSection === "automation" && (
            <>
              <div>
                <h2 className="text-xl font-bold">AI & Automation</h2>
                <p className="text-sm text-muted-foreground mt-1">Configure how the AI bot handles incoming messages.</p>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" /> Bot Configuration
                  </CardTitle>
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
            </>
          )}

          {/* ── EMAIL ──────────────────────────────────────────────────────── */}
          {activeSection === "email" && (
            <>
              <div>
                <h2 className="text-xl font-bold">Email Broadcasting</h2>
                <p className="text-sm text-muted-foreground mt-1">Connect Mailgun to send email campaigns to your customer list.</p>
              </div>
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-[#FF0010]/10 flex items-center justify-center">
                        <SiMailgun className="h-5 w-5 text-[#FF0010]" />
                      </div>
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          Mailgun
                          {emailConfig?.isActive ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </CardTitle>
                        <CardDescription>API credentials and sending domain</CardDescription>
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
                        <div>
                          <Label className="mb-1.5 flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Sending Domain</Label>
                          <Input placeholder="mg.yourdomain.com" value={mgDomain} onChange={(e) => setMgDomain(e.target.value)} className="font-mono text-sm" />
                          <p className="text-xs text-muted-foreground mt-1">The domain you configured in Mailgun</p>
                        </div>
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
                        <div>
                          <Label className="mb-1.5">From Name</Label>
                          <Input placeholder="CommsCRM" value={mgFromName} onChange={(e) => setMgFromName(e.target.value)} />
                        </div>
                        <div>
                          <Label className="mb-1.5">From Email</Label>
                          <Input type="email" placeholder="noreply@mg.yourdomain.com" value={mgFromEmail} onChange={(e) => setMgFromEmail(e.target.value)} className="font-mono text-sm" />
                          <p className="text-xs text-muted-foreground mt-1">Must use your verified Mailgun domain</p>
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <p className="text-sm font-medium mb-3">Test & Validate</p>
                        <div className="flex gap-3 flex-wrap items-end">
                          <div className="flex-1 min-w-48">
                            <Label className="text-xs text-muted-foreground mb-1.5 block">Test recipient email</Label>
                            <Input type="email" placeholder="you@example.com" value={mgTestEmail} onChange={(e) => setMgTestEmail(e.target.value)} />
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
            </>
          )}

          {/* ── TEAM ───────────────────────────────────────────────────────── */}
          {activeSection === "team" && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Team Management</h2>
                  <p className="text-sm text-muted-foreground mt-1">Add agents and manage their roles.</p>
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
              </div>
              <Card>
                <CardContent className="pt-6">
                  {isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : (
                    <div className="space-y-3">
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
            </>
          )}

          {/* ── APPEARANCE ─────────────────────────────────────────────────── */}
          {activeSection === "appearance" && (currentAgent?.role === "admin" || currentAgent?.role === "super_admin") && (
            <>
              <div>
                <h2 className="text-xl font-bold">Appearance</h2>
                <p className="text-sm text-muted-foreground mt-1">Customize your app's name, colors, logo, and background image.</p>
              </div>
              <Card>
                <CardContent className="pt-6 space-y-6">
                  <div className="space-y-2">
                    <Label>App Name</Label>
                    <Input value={brandingName} onChange={(e) => setBrandingName(e.target.value)} placeholder="CommsCRM" maxLength={100} className="max-w-xs" />
                    <p className="text-xs text-muted-foreground">Displayed in the sidebar header and browser title.</p>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Primary Color</Label>
                      <div className="flex items-center gap-3">
                        <input type="color" value={brandingPrimary} onChange={(e) => setBrandingPrimary(e.target.value)} className="h-10 w-10 rounded-md border cursor-pointer p-0.5 bg-transparent" title="Pick primary color" />
                        <Input value={brandingPrimary} onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setBrandingPrimary(e.target.value); }} className="font-mono text-sm w-32" maxLength={7} />
                        <div className="h-10 w-10 rounded-md border" style={{ backgroundColor: brandingPrimary }} />
                      </div>
                      <p className="text-xs text-muted-foreground">Buttons, links, badges, and accents.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Sidebar Color</Label>
                      <div className="flex items-center gap-3">
                        <input type="color" value={brandingSidebar} onChange={(e) => setBrandingSidebar(e.target.value)} className="h-10 w-10 rounded-md border cursor-pointer p-0.5 bg-transparent" title="Pick sidebar color" />
                        <Input value={brandingSidebar} onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setBrandingSidebar(e.target.value); }} className="font-mono text-sm w-32" maxLength={7} />
                        <div className="h-10 w-10 rounded-md border" style={{ backgroundColor: brandingSidebar }} />
                      </div>
                      <p className="text-xs text-muted-foreground">The left navigation sidebar background.</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <Label>Logo</Label>
                    <div className="flex items-start gap-4">
                      <div className="h-16 w-16 rounded-xl border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {logoPreview ? <img src={logoPreview} alt="Logo" className="h-full w-full object-contain p-1" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
                      </div>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <label className="cursor-pointer">
                            <input type="file" className="hidden" accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadBrandingFile(file, "logo"); e.target.value = ""; }} />
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
                  <div className="space-y-3">
                    <Label>Background Image</Label>
                    <div className="flex items-start gap-4">
                      <div className="h-16 w-24 rounded-xl border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {bgPreview ? <img src={bgPreview} alt="Background" className="h-full w-full object-cover" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
                      </div>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <label className="cursor-pointer">
                            <input type="file" className="hidden" accept="image/png,image/jpeg,image/jpg,image/gif,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadBrandingFile(file, "background"); e.target.value = ""; }} />
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
                  <Button variant="outline" size="sm" onClick={() => { setBrandingName("CommsCRM"); setBrandingPrimary("#4F46E5"); setBrandingSidebar("#3F0E40"); }} className="text-muted-foreground">
                    Reset to Defaults
                  </Button>
                </CardFooter>
              </Card>
            </>
          )}

          {/* ── FOLLOW-UP SETTINGS ───────────────────────────────── */}
          {activeSection === "followups" && <FollowUpSettingsSection />}

          {/* ── DATA RETENTION ───────────────────────────────────── */}
          {activeSection === "retention" && <RetentionSection />}

        </div>
      </main>
    </div>
  );
}

// ── Retention Section (separate component to keep state clean) ────────────────

const CHANNELS = [
  { id: "whatsapp", label: "WhatsApp", Icon: SiWhatsapp, color: "text-green-500" },
  { id: "facebook", label: "Facebook", Icon: SiFacebook, color: "text-blue-500" },
  { id: "instagram", label: "Instagram", Icon: SiInstagram, color: "text-pink-500" },
];

type RetentionAction = "archive" | "delete";

interface RetentionSettingsData {
  retentionDays: number;
  summarizeBeforeDelete: boolean;
  autoRunEnabled: boolean;
  action: RetentionAction;
  channelFilter: string[];
  includeClosedMessages: boolean;
  includeFeedback: boolean;
  minMessageCount: number;
}

interface RetentionStatsData {
  retentionDays: number;
  eligible: number;
  alreadySummarized: number;
  totalTranscripts: number;
  totalRawMessages: number;
  cutoffDate: string;
  channelBreakdown: Record<string, number>;
  feedbackEligible: number;
  totalFeedback: number;
  action: RetentionAction;
}

interface PreviewItem {
  id: number;
  customerName: string;
  channel: string;
  closedAt: string;
  messageCount: number;
}

interface PreviewData {
  eligible: number;
  action: RetentionAction;
  willSummarize: boolean;
  items: PreviewItem[];
  channelBreakdown: Record<string, number>;
}

function RetentionSection() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: settings, isLoading: settingsLoading } = useQuery<RetentionSettingsData>({
    queryKey: ["retention-settings"],
    queryFn: () => apiGet("/retention/settings"),
  });

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<RetentionStatsData>({
    queryKey: ["retention-stats"],
    queryFn: () => apiGet("/retention/stats"),
  });

  // Local editable state
  const [retentionDays, setRetentionDays] = useState<string>("90");
  const [summarize, setSummarize] = useState(true);
  const [action, setAction] = useState<RetentionAction>("archive");
  const [channelFilter, setChannelFilter] = useState<string[]>(["all"]);
  const [includeClosedMessages, setIncludeClosedMessages] = useState(true);
  const [includeFeedback, setIncludeFeedback] = useState(false);
  const [minMessageCount, setMinMessageCount] = useState("0");
  const [running, setRunning] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewing, setPreviewing] = useState(false);

  // Sync from API once loaded
  useEffect(() => {
    if (settings) {
      setRetentionDays(String(settings.retentionDays));
      setSummarize(settings.summarizeBeforeDelete);
      setAction(settings.action ?? "archive");
      setChannelFilter(Array.isArray(settings.channelFilter) ? settings.channelFilter : ["all"]);
      setIncludeClosedMessages(settings.includeClosedMessages ?? true);
      setIncludeFeedback(settings.includeFeedback ?? false);
      setMinMessageCount(String(settings.minMessageCount ?? 0));
    }
  }, [settings]);

  const toggleChannel = (ch: string) => {
    if (ch === "all") {
      setChannelFilter(["all"]);
      return;
    }
    setChannelFilter((prev) => {
      const without = prev.filter((c) => c !== "all");
      if (without.includes(ch)) {
        const next = without.filter((c) => c !== ch);
        return next.length === 0 ? ["all"] : next;
      } else {
        return [...without, ch];
      }
    });
  };

  const allSelected = channelFilter.includes("all");

  const saveSettings = useMutation({
    mutationFn: () => apiPut("/retention/settings", {
      retentionDays: Number(retentionDays) || 90,
      summarizeBeforeDelete: summarize,
      action,
      channelFilter,
      includeClosedMessages,
      includeFeedback,
      minMessageCount: Number(minMessageCount) || 0,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["retention-settings"] });
      qc.invalidateQueries({ queryKey: ["retention-stats"] });
      toast({ title: "Retention settings saved" });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    },
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  const runPreview = async () => {
    setPreviewing(true);
    try {
      // Save settings first so backend uses latest config
      await apiPut("/retention/settings", {
        retentionDays: Number(retentionDays) || 90,
        summarizeBeforeDelete: summarize,
        action,
        channelFilter,
        includeClosedMessages,
        includeFeedback,
        minMessageCount: Number(minMessageCount) || 0,
      });
      const data = await apiPost("/retention/preview", {});
      setPreview(data);
    } catch {
      toast({ title: "Failed to load preview", variant: "destructive" });
    } finally {
      setPreviewing(false);
    }
  };

  const runRetention = async () => {
    setRunning(true);
    try {
      const res = await apiPost("/retention/run", {});
      refetchStats();
      setPreview(null);
      toast({ title: res.message ?? "Retention run complete" });
    } catch {
      toast({ title: "Retention run failed", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const cutoff = stats?.cutoffDate
    ? new Date(stats.cutoffDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  const channelIcon = (ch: string) => {
    const found = CHANNELS.find((c) => c.id === ch);
    if (!found) return null;
    const { Icon, color } = found;
    return <Icon className={`h-3.5 w-3.5 ${color}`} />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Data Retention</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose which data to archive or delete, filter by transcript type and channel, then run cleanup on demand. Archived conversations keep their record with an AI summary; fully deleted ones are removed entirely.
        </p>
      </div>

      {/* Storage snapshot */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: "Closed Transcripts",
            value: stats?.totalTranscripts ?? "—",
            icon: FileText,
            color: "text-blue-500",
            sub: stats?.alreadySummarized ? `${stats.alreadySummarized} summarized` : undefined,
          },
          {
            label: "Raw Messages",
            value: stats?.totalRawMessages ?? "—",
            icon: MessageSquare,
            color: "text-violet-500",
            sub: "awaiting cleanup",
          },
          {
            label: "Ready for Cleanup",
            value: statsLoading ? "—" : (stats?.eligible ?? 0),
            icon: AlertTriangle,
            color: (stats?.eligible ?? 0) > 0 ? "text-orange-500" : "text-muted-foreground",
            sub: cutoff ? `before ${cutoff}` : undefined,
          },
          {
            label: "Feedback Records",
            value: stats?.totalFeedback ?? "—",
            icon: ThumbsUp,
            color: "text-green-500",
            sub: stats?.feedbackEligible ? `${stats.feedbackEligible} eligible` : undefined,
          },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold mt-1">{String(value)}</p>
                  {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
                </div>
                <Icon className={`h-5 w-5 mt-0.5 ${color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Target Data ─────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DatabaseZap className="h-4 w-4 text-primary" />
            Target Data
          </CardTitle>
          <CardDescription>Select which types of data will be included in the retention run.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Closed conversation messages */}
            <label className={cn(
              "flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
              includeClosedMessages ? "border-primary/40 bg-primary/5" : "hover:bg-muted/50"
            )}>
              <Checkbox
                checked={includeClosedMessages}
                onCheckedChange={(v) => setIncludeClosedMessages(Boolean(v))}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-medium text-sm">
                  <MessageCircle className="h-3.5 w-3.5 text-violet-500" />
                  Closed Conversation Messages
                </div>
                <p className="text-xs text-muted-foreground">
                  Raw message content from closed &amp; archived conversations. Conversation records are always kept (unless using Full Delete).
                </p>
                {stats && (
                  <p className="text-xs font-medium text-violet-600 dark:text-violet-400">
                    {stats.totalRawMessages} raw messages stored
                  </p>
                )}
              </div>
            </label>

            {/* Feedback records */}
            <label className={cn(
              "flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
              includeFeedback ? "border-primary/40 bg-primary/5" : "hover:bg-muted/50"
            )}>
              <Checkbox
                checked={includeFeedback}
                onCheckedChange={(v) => setIncludeFeedback(Boolean(v))}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-medium text-sm">
                  <ThumbsUp className="h-3.5 w-3.5 text-green-500" />
                  Feedback Records
                </div>
                <p className="text-xs text-muted-foreground">
                  Customer satisfaction feedback older than the retention period. Only applies when action is set to Full Delete.
                </p>
                {stats && (
                  <p className="text-xs font-medium text-green-600 dark:text-green-400">
                    {stats.feedbackEligible} of {stats.totalFeedback} eligible
                  </p>
                )}
              </div>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* ── Retention Period & Action ─────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            Retention Period &amp; Action
          </CardTitle>
          <CardDescription>
            Data older than your chosen period is eligible for cleanup.
            {cutoff && <span className="ml-1">Current cutoff: <strong>{cutoff}</strong>.</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Keep data for</Label>
            <Select
              value={settingsLoading ? "90" : (retentionDays || "90")}
              onValueChange={setRetentionDays}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days (recommended)</SelectItem>
                <SelectItem value="180">180 days (6 months)</SelectItem>
                <SelectItem value="365">1 year</SelectItem>
                <SelectItem value="730">2 years</SelectItem>
                <SelectItem value="99999">Forever (never delete)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>Action when eligible</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Archive */}
              <button
                type="button"
                onClick={() => setAction("archive")}
                className={cn(
                  "text-left rounded-lg border p-4 transition-colors",
                  action === "archive"
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "hover:bg-muted/50 border-border"
                )}
              >
                <div className="flex items-center gap-2 font-medium text-sm mb-1">
                  <Archive className="h-4 w-4 text-blue-500" />
                  Archive
                  {action === "archive" && <Badge variant="secondary" className="ml-auto text-xs">Selected</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Delete raw messages but keep the conversation record. AI can generate a summary before deletion so context is preserved.
                </p>
              </button>

              {/* Full Delete */}
              <button
                type="button"
                onClick={() => setAction("delete")}
                className={cn(
                  "text-left rounded-lg border p-4 transition-colors",
                  action === "delete"
                    ? "border-red-400 bg-red-50 dark:bg-red-900/10 ring-1 ring-red-400/30"
                    : "hover:bg-muted/50 border-border"
                )}
              >
                <div className="flex items-center gap-2 font-medium text-sm mb-1">
                  <Trash2 className="h-4 w-4 text-red-500" />
                  Full Delete
                  {action === "delete" && <Badge variant="destructive" className="ml-auto text-xs">Selected</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Permanently remove the entire conversation record including all messages. Cannot be undone. Useful for strict data compliance.
                </p>
              </button>
            </div>
          </div>

          {/* Summarize option — only for archive */}
          {action === "archive" && (
            <div className="flex items-start justify-between gap-4 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/40 p-4">
              <div className="space-y-1">
                <Label className="font-medium flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                  AI summarize before archiving
                </Label>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Before deleting raw messages, AI generates a concise 3–5 sentence summary of the conversation. The summary is stored permanently on the transcript record.
                </p>
              </div>
              <Switch checked={summarize} onCheckedChange={setSummarize} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Transcript Filters ───────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            Transcript Filters
          </CardTitle>
          <CardDescription>Narrow which transcripts are included in the retention run.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Channel filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Channel</Label>
            <div className="flex flex-wrap gap-2">
              {/* All button */}
              <button
                type="button"
                onClick={() => toggleChannel("all")}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                  allSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted"
                )}
              >
                All Channels
              </button>
              {CHANNELS.map(({ id, label, Icon, color }) => {
                const active = !allSelected && channelFilter.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleChannel(id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                      active
                        ? "bg-primary/10 border-primary/40 text-primary"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    <Icon className={`h-3 w-3 ${color}`} />
                    {label}
                    {stats?.channelBreakdown?.[id] !== undefined && (
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", active ? "bg-primary/20" : "bg-muted")}>
                        {stats.channelBreakdown[id]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Numbers show conversations currently eligible for cleanup per channel.
            </p>
          </div>

          <Separator />

          {/* Min message count */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Minimum message count</Label>
            <p className="text-xs text-muted-foreground">Only include conversations with at least this many messages. Set to 0 to include all.</p>
            <div className="flex flex-wrap gap-2">
              {["0", "5", "10", "20", "50"].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setMinMessageCount(v)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                    minMessageCount === v
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-muted"
                  )}
                >
                  {v === "0" ? "All" : `${v}+ messages`}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Save & Preview ───────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending} className="gap-2">
          {saveSettings.isPending
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : settingsSaved
              ? <CheckCircle2 className="h-4 w-4 text-green-500" />
              : <DatabaseZap className="h-4 w-4" />}
          {settingsSaved ? "Saved!" : "Save Settings"}
        </Button>
        <Button variant="outline" onClick={runPreview} disabled={previewing} className="gap-2">
          {previewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
          Preview Affected Data
        </Button>
        <Button variant="outline" size="sm" className="gap-2 ml-auto" onClick={() => refetchStats()} disabled={statsLoading}>
          <RefreshCw className={`h-3.5 w-3.5 ${statsLoading ? "animate-spin" : ""}`} /> Refresh Stats
        </Button>
      </div>

      {/* ── Preview Results ──────────────────────────── */}
      {preview && (
        <Card className="border-blue-200 dark:border-blue-900/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-500" />
              Preview: {preview.eligible} record{preview.eligible !== 1 ? "s" : ""} would be affected
            </CardTitle>
            <CardDescription>
              Action: <strong>{preview.action === "archive" ? "Archive" : "Full Delete"}</strong>
              {preview.willSummarize && " · AI summaries will be generated"}
              {" · "}
              <button onClick={() => setPreview(null)} className="text-blue-500 underline text-xs">Dismiss</button>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Channel breakdown */}
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map(({ id, label, Icon, color }) => (
                <div key={id} className="flex items-center gap-1.5 text-xs rounded-full bg-muted px-3 py-1.5">
                  <Icon className={`h-3 w-3 ${color}`} />
                  {label}: <strong>{preview.channelBreakdown[id] ?? 0}</strong>
                </div>
              ))}
            </div>

            {preview.items.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Customer</th>
                      <th className="text-left px-3 py-2 font-medium">Channel</th>
                      <th className="text-left px-3 py-2 font-medium">Messages</th>
                      <th className="text-left px-3 py-2 font-medium">Closed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.items.map((item, i) => (
                      <tr key={item.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                        <td className="px-3 py-2 font-medium">{item.customerName}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            {channelIcon(item.channel)}
                            <span className="capitalize">{item.channel}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{item.messageCount}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {new Date(item.closedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.eligible > 20 && (
                  <div className="px-3 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
                    Showing first 20 of {preview.eligible} records.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Run Now ─────────────────────────────────── */}
      <Card className={action === "delete" ? "border-red-200 dark:border-red-900/40" : "border-orange-200 dark:border-orange-900/40"}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Play className={`h-4 w-4 ${action === "delete" ? "text-red-500" : "text-orange-500"}`} />
            Run Retention Now
          </CardTitle>
          <CardDescription>
            Manually trigger a cleanup pass (up to 50 conversations per run).
            {stats && stats.eligible > 0 && (
              <span className={`ml-1 font-medium ${action === "delete" ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400"}`}>
                {stats.eligible} conversation{stats.eligible !== 1 ? "s" : ""} currently eligible.
              </span>
            )}
            {stats && stats.eligible === 0 && (
              <span className="ml-1 text-green-600 dark:text-green-400 font-medium"> No conversations eligible — all up to date!</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={cn(
            "rounded-lg border p-4 text-sm flex items-start gap-2.5",
            action === "delete"
              ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-300"
              : "bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-900/30 text-orange-700 dark:text-orange-300"
          )}>
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">
                {action === "delete" ? "Full Delete — this is irreversible." : "Archive — raw messages will be permanently deleted."}
              </p>
              <p>
                {action === "archive"
                  ? (summarize
                    ? "AI summaries will be saved before deletion. Conversation records are kept."
                    : "No summaries — raw messages deleted, conversation records kept.")
                  : "Entire conversation records + messages will be permanently removed. Feedback records will also be deleted if enabled above."}
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t bg-muted/20 px-6 py-4 flex gap-3">
          <Button
            variant="destructive"
            onClick={runRetention}
            disabled={running || (stats?.eligible === 0 && !includeFeedback)}
            className="gap-2"
          >
            {running
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
              : action === "delete"
                ? <><Trash2 className="h-4 w-4" /> Run Full Delete</>
                : <><Archive className="h-4 w-4" /> Run Archive</>}
          </Button>
        </CardFooter>
      </Card>

      {/* Already archived summary */}
      {stats && stats.alreadySummarized > 0 && (
        <Card>
          <CardContent className="pt-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-sm">
                {stats.alreadySummarized} transcript{stats.alreadySummarized !== 1 ? "s" : ""} already archived
              </p>
              <p className="text-xs text-muted-foreground">
                Raw messages deleted, AI summaries preserved. These conversations are still visible in Transcripts with their summary.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Follow-Up Settings Section ────────────────────────────────────────────────

type FollowUpCategory = "sales" | "reminder" | "product_update" | "discount" | "reengagement" | "custom";
type FollowUpTrigger = "resolved" | "inactive" | "manual";
type FollowUpPriority = "low" | "medium" | "high";

interface FollowUpRule {
  id: number;
  name: string;
  category: FollowUpCategory;
  isEnabled: boolean;
  delayDays: number;
  trigger: FollowUpTrigger;
  inactivityDays: number | null;
  messageTemplate: string;
  useAiPersonalization: boolean;
  assignToLastAgent: boolean;
  priority: FollowUpPriority;
  sendBetweenHoursStart: number;
  sendBetweenHoursEnd: number;
}

const CATEGORY_META: Record<FollowUpCategory, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  sales:          { label: "Sales",           icon: ShoppingCart, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  reminder:       { label: "Reminder",        icon: Bell,         color: "text-blue-600 dark:text-blue-400",      bg: "bg-blue-50 dark:bg-blue-900/20" },
  product_update: { label: "Product Update",  icon: Package,      color: "text-violet-600 dark:text-violet-400",  bg: "bg-violet-50 dark:bg-violet-900/20" },
  discount:       { label: "Discount",        icon: Tag,          color: "text-orange-600 dark:text-orange-400",  bg: "bg-orange-50 dark:bg-orange-900/20" },
  reengagement:   { label: "Re-engagement",   icon: UserCheck,    color: "text-rose-600 dark:text-rose-400",      bg: "bg-rose-50 dark:bg-rose-900/20" },
  custom:         { label: "Custom",          icon: Settings2,    color: "text-gray-600 dark:text-gray-400",      bg: "bg-gray-50 dark:bg-gray-900/20" },
};

const PRIORITY_COLORS: Record<FollowUpPriority, string> = {
  high:   "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  low:    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const TRIGGER_LABELS: Record<FollowUpTrigger, string> = {
  resolved: "After conversation resolved",
  inactive: "After customer inactivity",
  manual:   "Manual / campaign trigger",
};

const EMPTY_RULE: Omit<FollowUpRule, "id"> = {
  name: "",
  category: "custom",
  isEnabled: false,
  delayDays: 3,
  trigger: "manual",
  inactivityDays: null,
  messageTemplate: "",
  useAiPersonalization: false,
  assignToLastAgent: true,
  priority: "medium",
  sendBetweenHoursStart: 9,
  sendBetweenHoursEnd: 18,
};

function FollowUpSettingsSection() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ rules: FollowUpRule[] }>({
    queryKey: ["follow-up-rules"],
    queryFn: () => apiGet("/follow-up-rules"),
  });

  const rules = data?.rules ?? [];

  const [editRule, setEditRule] = useState<Partial<FollowUpRule> | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function openNew() {
    setEditRule({ ...EMPTY_RULE });
    setIsDialogOpen(true);
  }

  function openEdit(rule: FollowUpRule) {
    setEditRule({ ...rule });
    setIsDialogOpen(true);
  }

  async function saveRule() {
    if (!editRule?.name || !editRule?.messageTemplate) {
      toast({ title: "Name and message template are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editRule.id) {
        await apiPut(`/follow-up-rules/${editRule.id}`, editRule);
        toast({ title: "Rule updated" });
      } else {
        await apiPost("/follow-up-rules", editRule);
        toast({ title: "Rule created" });
      }
      qc.invalidateQueries({ queryKey: ["follow-up-rules"] });
      setIsDialogOpen(false);
      setEditRule(null);
    } catch {
      toast({ title: "Failed to save rule", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(rule: FollowUpRule) {
    try {
      await apiPost(`/follow-up-rules/${rule.id}/toggle`, {});
      qc.invalidateQueries({ queryKey: ["follow-up-rules"] });
      toast({ title: rule.isEnabled ? "Rule disabled" : "Rule enabled" });
    } catch {
      toast({ title: "Failed to toggle rule", variant: "destructive" });
    }
  }

  async function deleteRule(id: number) {
    setDeletingId(id);
    try {
      await apiDelete(`/follow-up-rules/${id}`);
      qc.invalidateQueries({ queryKey: ["follow-up-rules"] });
      toast({ title: "Rule deleted" });
    } catch {
      toast({ title: "Failed to delete rule", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  const activeCount = rules.filter((r) => r.isEnabled).length;

  return (
    <div className="space-y-6 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Follow-up Automation</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure automated follow-up rules to nurture customers across sales, reminders, product updates, and more.
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={openNew}>
          <Plus className="h-4 w-4" /> New Rule
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 bg-muted/40">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Total Rules</p>
            <p className="text-2xl font-bold mt-0.5">{rules.length}</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-muted/40">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Active Rules</p>
            <p className="text-2xl font-bold mt-0.5 text-emerald-600">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-muted/40">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Paused Rules</p>
            <p className="text-2xl font-bold mt-0.5 text-muted-foreground">{rules.length - activeCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/20 p-4 flex items-start gap-3 text-sm text-blue-700 dark:text-blue-300">
        <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">How automation rules work</p>
          <p className="mt-0.5 text-blue-600/80 dark:text-blue-400/80">
            When a trigger fires (e.g. conversation resolved), the system schedules the follow-up message to be sent after the configured delay, within the allowed sending window.
            Rules with <strong>AI Personalisation</strong> will tailor the message using the customer's conversation history.
          </p>
        </div>
      </div>

      {/* Rules list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const meta = CATEGORY_META[rule.category] ?? CATEGORY_META.custom;
            const Icon = meta.icon;
            const isExpanded = expandedId === rule.id;

            return (
              <Card key={rule.id} className={cn("transition-all", rule.isEnabled ? "" : "opacity-60")}>
                <CardContent className="pt-4 pb-3 px-5">
                  {/* Top row */}
                  <div className="flex items-start gap-3">
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5", meta.bg)}>
                      <Icon className={cn("h-4 w-4", meta.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{rule.name}</span>
                        <Badge variant="outline" className="text-xs px-1.5">{meta.label}</Badge>
                        <Badge className={cn("text-xs px-1.5", PRIORITY_COLORS[rule.priority])}>
                          {rule.priority.charAt(0).toUpperCase() + rule.priority.slice(1)} priority
                        </Badge>
                        {rule.useAiPersonalization && (
                          <Badge className="text-xs px-1.5 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 gap-1">
                            <Sparkles className="h-2.5 w-2.5" /> AI
                          </Badge>
                        )}
                        {rule.isEnabled && (
                          <Badge className="text-xs px-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {TRIGGER_LABELS[rule.trigger]} · Send after <strong>{rule.delayDays}d</strong> · {rule.sendBetweenHoursStart}:00–{rule.sendBetweenHoursEnd}:00
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setExpandedId(isExpanded ? null : rule.id)}
                        title="Expand"
                      >
                        <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(rule)} title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-7 w-7", rule.isEnabled ? "text-emerald-600" : "text-muted-foreground")}
                        onClick={() => toggleRule(rule)}
                        title={rule.isEnabled ? "Disable" : "Enable"}
                      >
                        {rule.isEnabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive/60 hover:text-destructive"
                        onClick={() => deleteRule(rule.id)}
                        disabled={deletingId === rule.id}
                        title="Delete"
                      >
                        {deletingId === rule.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded view */}
                  {isExpanded && (
                    <div className="mt-4 pt-3 border-t space-y-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">Message Template</p>
                        <div className="rounded-lg bg-muted/50 border p-3 text-sm text-foreground leading-relaxed">
                          {rule.messageTemplate}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-lg bg-muted/30 border p-2.5">
                          <p className="text-muted-foreground mb-0.5">Trigger</p>
                          <p className="font-medium">{TRIGGER_LABELS[rule.trigger]}</p>
                          {rule.trigger === "inactive" && rule.inactivityDays && (
                            <p className="text-muted-foreground">After {rule.inactivityDays} days inactive</p>
                          )}
                        </div>
                        <div className="rounded-lg bg-muted/30 border p-2.5">
                          <p className="text-muted-foreground mb-0.5">Sending Window</p>
                          <p className="font-medium">{rule.sendBetweenHoursStart}:00 – {rule.sendBetweenHoursEnd}:00</p>
                          <p className="text-muted-foreground">Delay: {rule.delayDays} day{rule.delayDays !== 1 ? "s" : ""}</p>
                        </div>
                        <div className="rounded-lg bg-muted/30 border p-2.5">
                          <p className="text-muted-foreground mb-0.5">Assignment</p>
                          <p className="font-medium">{rule.assignToLastAgent ? "Assign to last agent" : "Unassigned"}</p>
                        </div>
                        <div className="rounded-lg bg-muted/30 border p-2.5">
                          <p className="text-muted-foreground mb-0.5">AI Personalisation</p>
                          <p className="font-medium">{rule.useAiPersonalization ? "Enabled" : "Disabled"}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {rules.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarClock className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No follow-up rules yet. Create your first one above.</p>
            </div>
          )}
        </div>
      )}

      {/* Edit / Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) setEditRule(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editRule?.id ? "Edit Rule" : "New Follow-up Rule"}</DialogTitle>
          </DialogHeader>

          {editRule && (
            <div className="space-y-4 py-2">
              {/* Name */}
              <div className="space-y-1.5">
                <Label>Rule Name</Label>
                <Input
                  value={editRule.name ?? ""}
                  onChange={(e) => setEditRule((r) => r ? { ...r, name: e.target.value } : r)}
                  placeholder="e.g. Post-sale check-in"
                />
              </div>

              {/* Category + Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select
                    value={editRule.category ?? "custom"}
                    onValueChange={(v) => setEditRule((r) => r ? { ...r, category: v as FollowUpCategory } : r)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="reminder">Reminder</SelectItem>
                      <SelectItem value="product_update">Product Update</SelectItem>
                      <SelectItem value="discount">Discount</SelectItem>
                      <SelectItem value="reengagement">Re-engagement</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select
                    value={editRule.priority ?? "medium"}
                    onValueChange={(v) => setEditRule((r) => r ? { ...r, priority: v as FollowUpPriority } : r)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Trigger */}
              <div className="space-y-1.5">
                <Label>Trigger</Label>
                <Select
                  value={editRule.trigger ?? "manual"}
                  onValueChange={(v) => setEditRule((r) => r ? { ...r, trigger: v as FollowUpTrigger } : r)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resolved">After conversation resolved</SelectItem>
                    <SelectItem value="inactive">After customer inactivity</SelectItem>
                    <SelectItem value="manual">Manual / campaign trigger</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Inactivity days (conditional) */}
              {editRule.trigger === "inactive" && (
                <div className="space-y-1.5">
                  <Label>Days of inactivity before triggering</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editRule.inactivityDays ?? ""}
                    onChange={(e) => setEditRule((r) => r ? { ...r, inactivityDays: Number(e.target.value) || null } : r)}
                    placeholder="e.g. 7"
                  />
                </div>
              )}

              {/* Delay */}
              <div className="space-y-1.5">
                <Label>Send after (days from trigger)</Label>
                <Input
                  type="number"
                  min={0}
                  value={editRule.delayDays ?? 3}
                  onChange={(e) => setEditRule((r) => r ? { ...r, delayDays: Number(e.target.value) || 0 } : r)}
                />
              </div>

              {/* Sending window */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Send from (hour)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={editRule.sendBetweenHoursStart ?? 9}
                    onChange={(e) => setEditRule((r) => r ? { ...r, sendBetweenHoursStart: Number(e.target.value) } : r)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Send until (hour)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={editRule.sendBetweenHoursEnd ?? 18}
                    onChange={(e) => setEditRule((r) => r ? { ...r, sendBetweenHoursEnd: Number(e.target.value) } : r)}
                  />
                </div>
              </div>

              {/* Message template */}
              <div className="space-y-1.5">
                <Label>Message Template</Label>
                <p className="text-xs text-muted-foreground">Use <code className="bg-muted px-1 rounded">{"{{customerName}}"}</code> to personalise.</p>
                <textarea
                  className="w-full min-h-[110px] rounded-md border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                  value={editRule.messageTemplate ?? ""}
                  onChange={(e) => setEditRule((r) => r ? { ...r, messageTemplate: e.target.value } : r)}
                  placeholder="Hi {{customerName}}! Just checking in…"
                />
              </div>

              <Separator />

              {/* Toggles */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">AI Personalisation</p>
                    <p className="text-xs text-muted-foreground">Let AI tailor the message using conversation history</p>
                  </div>
                  <Switch
                    checked={editRule.useAiPersonalization ?? false}
                    onCheckedChange={(v) => setEditRule((r) => r ? { ...r, useAiPersonalization: v } : r)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Assign to last agent</p>
                    <p className="text-xs text-muted-foreground">Re-assign the follow-up to whoever handled the conversation</p>
                  </div>
                  <Switch
                    checked={editRule.assignToLastAgent ?? true}
                    onCheckedChange={(v) => setEditRule((r) => r ? { ...r, assignToLastAgent: v } : r)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Enable rule immediately</p>
                    <p className="text-xs text-muted-foreground">Rule will start triggering follow-ups right away</p>
                  </div>
                  <Switch
                    checked={editRule.isEnabled ?? false}
                    onCheckedChange={(v) => setEditRule((r) => r ? { ...r, isEnabled: v } : r)}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsDialogOpen(false); setEditRule(null); }}>Cancel</Button>
            <Button onClick={saveRule} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editRule?.id ? "Save Changes" : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
