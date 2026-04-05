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
import { SiWhatsapp, SiFacebook, SiInstagram, SiMailgun, SiX, SiAuthy } from "react-icons/si";
import {
  CheckCircle2, Bot, Trash2, Loader2, Eye, EyeOff, XCircle, Zap, Send,
  Globe, Palette, Upload, X, Image as ImageIcon, Wifi, Settings2, Users,
  Mail, ChevronRight, DatabaseZap, Play, RefreshCw, Archive, MessageSquare,
  AlertTriangle, CalendarClock, Plus, Pencil, ToggleLeft, ToggleRight,
  ShoppingCart, Bell, Package, Tag, UserCheck, Sparkles, Clock, ChevronDown, ChevronUp,
  Filter, FileText, MessageCircle, ThumbsUp, ShieldCheck,
  MapPin, Building2, Plus as PlusIcon, Trash2 as TrashIcon, Pencil as PencilIcon,
  Copy, Check, Link2, Code2, QrCode, CreditCard, Banknote, TestTube2, ToggleRight as Toggle,
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

interface ApiAgent { id: number; name: string; email: string; role: string; isActive: boolean; allowedMenus: string[] | null; siteIds: number[] | null; }

// ── All menus available for permission control ────────────────────────────────
const ALL_MENUS = [
  // Core
  { slug: "dashboard",          name: "Dashboard",          group: "Core" },
  { slug: "inbox",              name: "Inbox",              group: "Core" },
  { slug: "customers",          name: "Customers",          group: "Core" },
  { slug: "follow-ups",         name: "Follow-ups",         group: "Core" },
  { slug: "feedback",           name: "Feedback",           group: "Core" },
  { slug: "campaigns",          name: "Campaigns",          group: "Core" },
  { slug: "kpi",                name: "KPI Ranking",        group: "Core" },
  { slug: "clock-in",           name: "Clock In",           group: "Core" },
  // Analytics
  { slug: "analytics",          name: "Overview",           group: "Analytics" },
  { slug: "intelligence",       name: "Intelligence",       group: "Analytics" },
  { slug: "product-demand",     name: "Product Demand",     group: "Analytics" },
  { slug: "transcripts",        name: "Transcripts",        group: "Analytics" },
  { slug: "contacts-analytics", name: "Contacts Analytics", group: "Analytics" },
  // Tools
  { slug: "ai-chat",            name: "AI Assistant",       group: "Tools" },
  { slug: "channels",           name: "Channels",           group: "Tools" },
  { slug: "settings",           name: "Settings",           group: "Tools" },
  // Admin
  { slug: "admin",              name: "User Management",    group: "Admin" },
] as const;

const MENU_GROUPS = ["Core", "Analytics", "Tools", "Admin"] as const;
type MenuSlug = typeof ALL_MENUS[number]["slug"];

type SettingsSection = "channels" | "automation" | "email" | "team" | "appearance" | "retention" | "followups" | "sites" | "security" | "payments";

interface ApiSite {
  id: number;
  name: string;
  description: string | null;
  region: string | null;
  isActive: boolean;
}

interface ApiChannel {
  id: number;
  type: string;
  name: string;
  siteId: number | null;
  isConnected: boolean;
  webhookVerifyToken?: string;
  phoneNumberId?: string;
  wabaId?: string;
  pageId?: string;
  instagramAccountId?: string;
  hasAccessToken?: boolean;
  hasPageAccessToken?: boolean;
  hasTwitterCreds?: boolean;
  twitterApiKey?: string;
  createdAt?: string;
}

interface NavItem {
  id: SettingsSection;
  label: string;
  description: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: "channels",    label: "Channels",        description: "Connected platforms",   icon: Wifi },
  { id: "payments",    label: "Payments",        description: "Payment gateways",      icon: ShoppingCart, adminOnly: true },
  { id: "sites",       label: "Sites",           description: "Branches & regions",    icon: Building2, adminOnly: true },
  { id: "security",    label: "Security",        description: "2FA & account safety",  icon: ShieldCheck },
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
  // Menu permissions for new agent
  const [newCustomPerms, setNewCustomPerms] = useState(false);
  const [newAllowedMenus, setNewAllowedMenus] = useState<MenuSlug[]>([...ALL_MENUS.map((m) => m.slug)]);
  // Edit permissions dialog
  const [permEditAgent, setPermEditAgent] = useState<ApiAgent | null>(null);
  const [permMenus, setPermMenus] = useState<MenuSlug[]>([]);
  const [permCustom, setPermCustom] = useState(false);

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
      setNewCustomPerms(false); setNewAllowedMenus([...ALL_MENUS.map((m) => m.slug)]);
      setNewAgentSiteIds([]);
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

  const updateMenusMutation = useMutation({
    mutationFn: ({ id, allowedMenus }: { id: number; allowedMenus: string[] | null }) =>
      apiPut(`/agents/${id}/menus`, { allowedMenus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      setPermEditAgent(null);
      toast({ title: "Permissions updated", description: "Menu access has been saved." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function openPermEdit(agent: ApiAgent) {
    setPermEditAgent(agent);
    const menus = agent.allowedMenus;
    if (menus === null) {
      setPermCustom(false);
      setPermMenus([...ALL_MENUS.map((m) => m.slug)] as MenuSlug[]);
    } else {
      setPermCustom(true);
      setPermMenus(menus as MenuSlug[]);
    }
  }

  function toggleMenu(list: MenuSlug[], slug: MenuSlug): MenuSlug[] {
    return list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug];
  }

  function toggleGroupAll(list: MenuSlug[], group: string, checked: boolean): MenuSlug[] {
    const groupSlugs = ALL_MENUS.filter((m) => m.group === group).map((m) => m.slug) as MenuSlug[];
    if (checked) return [...new Set([...list, ...groupSlugs])];
    return list.filter((s) => !groupSlugs.includes(s));
  }

  // ── Sites state ──────────────────────────────────────────────────────────────
  const [isSiteAddOpen, setIsSiteAddOpen] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteDesc, setNewSiteDesc] = useState("");
  const [newSiteRegion, setNewSiteRegion] = useState("");
  const [editSite, setEditSite] = useState<ApiSite | null>(null);
  const [editSiteName, setEditSiteName] = useState("");
  const [editSiteDesc, setEditSiteDesc] = useState("");
  const [editSiteRegion, setEditSiteRegion] = useState("");

  const { data: sites = [] } = useQuery<ApiSite[]>({
    queryKey: ["sites"],
    queryFn: () => apiGet("/sites"),
  });

  const addSiteMutation = useMutation({
    mutationFn: (data: object) => apiPost("/sites", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sites"] });
      setIsSiteAddOpen(false);
      setNewSiteName(""); setNewSiteDesc(""); setNewSiteRegion("");
      toast({ title: "Site added" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateSiteMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number; name: string; description: string; region: string }) =>
      apiPut(`/sites/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sites"] });
      setEditSite(null);
      toast({ title: "Site updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteSiteMutation = useMutation({
    mutationFn: (id: number) => apiDelete(`/sites/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sites"] });
      toast({ title: "Site deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function openEditSite(s: ApiSite) {
    setEditSite(s);
    setEditSiteName(s.name);
    setEditSiteDesc(s.description ?? "");
    setEditSiteRegion(s.region ?? "");
  }

  // ── Channels (multi-account) state ────────────────────────────────────────
  const [isAddChOpen, setIsAddChOpen] = useState(false);
  const [addChType, setAddChType] = useState("whatsapp");
  const [addChName, setAddChName] = useState("");
  const [addChSiteId, setAddChSiteId] = useState<string>("");
  const [newAgentSiteIds, setNewAgentSiteIds] = useState<number[]>([]);

  const { data: settingsChannels = [], refetch: refetchChannels } = useQuery<ApiChannel[]>({
    queryKey: ["settingsChannels"],
    queryFn: () => apiGet("/channels"),
  });

  const addChMutation = useMutation({
    mutationFn: (data: object) => apiPost("/channels", data),
    onSuccess: () => {
      refetchChannels();
      setIsAddChOpen(false);
      setAddChName(""); setAddChSiteId("");
      toast({ title: "Channel account added" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // revealed secrets: key = `${channelId}-${field}`
  const [revealedFields, setRevealedFields] = useState<Record<string, boolean>>({});
  const [chCopied, setChCopied] = useState<string | null>(null);
  function toggleReveal(key: string) { setRevealedFields((p) => ({ ...p, [key]: !p[key] })); }
  function copyChField(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => { setChCopied(key); setTimeout(() => setChCopied(null), 2000); });
  }

  const regenChMutation = useMutation({
    mutationFn: ({ id, field }: { id: number; field: string }) =>
      apiPost(`/channels/${id}/regenerate`, { field }),
    onSuccess: () => { refetchChannels(); toast({ title: "Token regenerated successfully" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteChMutation = useMutation({
    mutationFn: (id: number) => apiDelete(`/channels/${id}`),
    onSuccess: () => {
      refetchChannels();
      toast({ title: "Channel account removed" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // ── Payments state ────────────────────────────────────────────────────────
  type PaymentProvider = "stripe" | "paystack" | "flutterwave" | "paypal" | "square";
  interface PaymentCfg {
    id?: number; provider: PaymentProvider; isEnabled: boolean; isLiveMode: boolean;
    publicKey: string | null; secretKey: string | null; webhookSecret: string | null;
    webhookToken?: string; hasSecretKey?: boolean; hasWebhookSecret?: boolean;
  }
  const { data: paymentConfigs = [], refetch: refetchPayments } = useQuery<PaymentCfg[]>({
    queryKey: ["payment-configs"],
    queryFn: () => apiGet("/payment-configs"),
    enabled: activeSection === "payments",
  });
  const [payReveal, setPayReveal] = useState<Record<string, boolean>>({});
  const [payCopied, setPayCopied] = useState<string | null>(null);
  const [payTestResult, setPayTestResult] = useState<Record<string, { success: boolean; message: string } | null>>({});
  const [payTestLoading, setPayTestLoading] = useState<Record<string, boolean>>({});
  const [payEdit, setPayEdit] = useState<Record<PaymentProvider, Partial<PaymentCfg>>>({} as any);

  function getPayCfg(provider: PaymentProvider): PaymentCfg {
    return paymentConfigs.find((c) => c.provider === provider) ?? {
      provider, isEnabled: false, isLiveMode: false, publicKey: null, secretKey: null, webhookSecret: null,
    };
  }
  function getPayEdit(provider: PaymentProvider) {
    return payEdit[provider] ?? {};
  }
  function setPayField(provider: PaymentProvider, field: string, value: unknown) {
    setPayEdit((p) => ({ ...p, [provider]: { ...(p[provider] ?? {}), [field]: value } }));
  }

  const savePayMutation = useMutation({
    mutationFn: ({ provider, data }: { provider: string; data: object }) =>
      apiPut(`/payment-configs/${provider}`, data),
    onSuccess: (_data, vars) => {
      refetchPayments();
      setPayEdit((p) => { const n = { ...p }; delete (n as any)[vars.provider]; return n; });
      toast({ title: "Payment settings saved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const regenPayWebhookMutation = useMutation({
    mutationFn: (provider: string) => apiPost(`/payment-configs/${provider}/regenerate-webhook`, {}),
    onSuccess: () => { refetchPayments(); toast({ title: "Webhook URL regenerated" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  async function testPayConnection(provider: PaymentProvider) {
    setPayTestLoading((p) => ({ ...p, [provider]: true }));
    setPayTestResult((p) => ({ ...p, [provider]: null }));
    try {
      const result = await apiPost<{ success: boolean; message: string }>(`/payment-configs/${provider}/test`, {});
      setPayTestResult((p) => ({ ...p, [provider]: result }));
    } catch (err) {
      setPayTestResult((p) => ({ ...p, [provider]: { success: false, message: String(err) } }));
    } finally {
      setPayTestLoading((p) => ({ ...p, [provider]: false }));
    }
  }

  function copyPay(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => { setPayCopied(key); setTimeout(() => setPayCopied(null), 2000); });
  }

  // ── WhatsApp Connection Tools state ──────────────────────────────────────
  const [waToolsOpen, setWaToolsOpen] = useState(false);
  const [waActiveTab, setWaActiveTab] = useState<"link" | "widget">("link");
  const [waPhone, setWaPhone] = useState("");
  const [waMessage, setWaMessage] = useState("Hi! I'd like to get in touch with you.");
  const [waCopied, setWaCopied] = useState<string | null>(null);

  const waCleanPhone = waPhone.replace(/[^0-9+]/g, "").replace(/^\+/, "");
  const waLink = waCleanPhone
    ? `https://wa.me/${waCleanPhone}${waMessage.trim() ? "?text=" + encodeURIComponent(waMessage.trim()) : ""}`
    : "";
  const waQrUrl = waLink
    ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(waLink)}&size=200x200&margin=12&color=25-209-94&bgcolor=ffffff`
    : "";
  const waWidgetCode = waCleanPhone ? `<!-- WhatsApp Chat Widget by CommsCRM -->
<a href="https://wa.me/${waCleanPhone}${waMessage.trim() ? "?text=" + encodeURIComponent(waMessage.trim()) : ""}"
   target="_blank" rel="noopener noreferrer"
   style="position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;align-items:center;
          justify-content:center;width:60px;height:60px;border-radius:50%;background:#25D366;
          box-shadow:0 4px 16px rgba(0,0,0,0.3);text-decoration:none;
          transition:transform 0.2s,box-shadow 0.2s;"
   onmouseover="this.style.transform='scale(1.1)'"
   onmouseout="this.style.transform='scale(1)'">
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="white" viewBox="0 0 24 24">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
  </svg>
</a>` : "";

  function copyWa(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setWaCopied(key);
      setTimeout(() => setWaCopied(null), 2000);
    });
  }

  // ── Security / 2FA state ──────────────────────────────────────────────────
  const [twoFaStep, setTwoFaStep] = useState<"idle" | "setup" | "disable">("idle");
  const [twoFaQr, setTwoFaQr] = useState<string | null>(null);
  const [twoFaSecret, setTwoFaSecret] = useState<string | null>(null);
  const [twoFaCode, setTwoFaCode] = useState("");
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaError, setTwoFaError] = useState("");

  const { data: twoFaStatus, refetch: refetchTwoFa } = useQuery<{ totpEnabled: boolean }>({
    queryKey: ["2fa-status"],
    queryFn: () => apiGet("/auth/2fa/status"),
    enabled: activeSection === "security",
  });

  async function startTwoFaSetup() {
    setTwoFaLoading(true); setTwoFaError("");
    try {
      const data: { qrCode: string; secret: string } = await apiGet("/auth/2fa/setup");
      setTwoFaQr(data.qrCode);
      setTwoFaSecret(data.secret);
      setTwoFaStep("setup");
      setTwoFaCode("");
    } catch (err: unknown) {
      setTwoFaError(err instanceof Error ? err.message : "Failed to start 2FA setup");
    } finally {
      setTwoFaLoading(false);
    }
  }

  async function enableTwoFa() {
    if (!twoFaCode.trim()) return;
    setTwoFaLoading(true); setTwoFaError("");
    try {
      await apiPost("/auth/2fa/enable", { code: twoFaCode.trim() });
      setTwoFaStep("idle"); setTwoFaQr(null); setTwoFaSecret(null); setTwoFaCode("");
      await refetchTwoFa();
      toast({ title: "2FA enabled", description: "Your account is now protected by two-factor authentication." });
    } catch (err: unknown) {
      setTwoFaError(err instanceof Error ? err.message : "Failed to enable 2FA");
    } finally {
      setTwoFaLoading(false);
    }
  }

  async function disableTwoFa() {
    if (!twoFaCode.trim()) return;
    setTwoFaLoading(true); setTwoFaError("");
    try {
      await apiPost("/auth/2fa/disable", { code: twoFaCode.trim() });
      setTwoFaStep("idle"); setTwoFaCode("");
      await refetchTwoFa();
      toast({ title: "2FA disabled", description: "Two-factor authentication has been removed from your account." });
    } catch (err: unknown) {
      setTwoFaError(err instanceof Error ? err.message : "Failed to disable 2FA");
    } finally {
      setTwoFaLoading(false);
    }
  }

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
                    ? "bg-blue-600 text-white"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
                data-testid={`settings-nav-${item.id}`}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground")} />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium leading-tight", isActive ? "text-white" : "")}>{item.label}</p>
                  <p className={cn("text-[11px] truncate mt-0.5 leading-tight", isActive ? "text-white/70" : "text-muted-foreground")}>{item.description}</p>
                </div>
                {isActive && <ChevronRight className="h-3.5 w-3.5 text-white/70 shrink-0" />}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── Right content area ─────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-3xl space-y-6">

          {/* ── CHANNELS ───────────────────────────────────────────────────── */}
          {activeSection === "channels" && (() => {
            const CH_META: { type: string; label: string; Icon: React.ElementType; color: string; bg: string }[] = [
              { type: "whatsapp",  label: "WhatsApp Business",  Icon: SiWhatsapp,  color: "text-[#25D366]", bg: "bg-[#25D366]/10" },
              { type: "facebook",  label: "Facebook Messenger", Icon: SiFacebook,  color: "text-[#1877F2]", bg: "bg-[#1877F2]/10" },
              { type: "instagram", label: "Instagram Direct",   Icon: SiInstagram, color: "text-pink-500",   bg: "bg-pink-500/10"  },
              { type: "twitter",   label: "Twitter / X DM",     Icon: SiX,         color: "text-sky-500",    bg: "bg-sky-500/10"   },
              { type: "widget",    label: "Web Chat Widget",     Icon: MessageCircle, color: "text-violet-500", bg: "bg-violet-500/10" },
            ];
            return (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Channel Accounts</h2>
                    <p className="text-sm text-muted-foreground mt-1">Connect multiple accounts per platform. Each account can be assigned to a site.</p>
                  </div>
                  <Button size="sm" className="gap-1.5" onClick={() => setIsAddChOpen(true)}>
                    <PlusIcon className="h-4 w-4" /> Add Account
                  </Button>
                </div>

                <div className="space-y-5">
                  {CH_META.map(({ type, label, Icon, color, bg }) => {
                    const accounts = settingsChannels.filter((c) => c.type === type);

                    // Helper: masked secret row with view/copy/regen
                    function SecretRow({ ch, field, label: fieldLabel, value, canRegen = false }: {
                      ch: ApiChannel; field: string; label: string; value?: string; canRegen?: boolean;
                    }) {
                      const revealKey = `${ch.id}-${field}`;
                      const copyKey = `${ch.id}-${field}-copy`;
                      const isRevealed = !!revealedFields[revealKey];
                      const isRegen = regenChMutation.isPending && regenChMutation.variables?.id === ch.id && regenChMutation.variables?.field === field;
                      if (!value) return null;
                      return (
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">{fieldLabel}</Label>
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 bg-muted/50 border rounded-lg px-3 py-2 font-mono text-xs min-w-0 truncate">
                              {isRevealed ? value : "•".repeat(Math.min(value.length, 32))}
                            </div>
                            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" title={isRevealed ? "Hide" : "Show"}
                              onClick={() => toggleReveal(revealKey)}>
                              {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" title="Copy"
                              onClick={() => copyChField(value, copyKey)}>
                              {chCopied === copyKey ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                            {canRegen && (
                              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" title="Regenerate" disabled={isRegen}
                                onClick={() => regenChMutation.mutate({ id: ch.id, field })}>
                                <RefreshCw className={`h-3.5 w-3.5 ${isRegen ? "animate-spin" : ""}`} />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <Card key={type} className="overflow-hidden">
                        {/* ── Card header ── */}
                        <CardHeader className="pb-4 pt-5 px-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`h-12 w-12 rounded-2xl ${bg} flex items-center justify-center shrink-0`}>
                                <Icon className={`h-6 w-6 ${color}`} />
                              </div>
                              <div>
                                <CardTitle className="text-base font-semibold">{label}</CardTitle>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                  {accounts.length === 0
                                    ? "No accounts connected"
                                    : `${accounts.length} account${accounts.length !== 1 ? "s" : ""} connected`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {accounts.some((a) => a.isConnected) && (
                                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> Active
                                </span>
                              )}
                            </div>
                          </div>
                        </CardHeader>

                        {/* ── Accounts list ── */}
                        {accounts.length > 0 && (
                          <CardContent className="pt-0 px-6 pb-4 space-y-3">
                            <Separator />
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Connected Accounts</p>
                            {accounts.map((ch) => {
                              const site = sites.find((s) => s.id === ch.siteId);
                              const webhookUrl = `${window.location.origin.replace(/:\d+/, ":3002")}/api/webhook/${ch.type}/${ch.id}`;
                              return (
                                <div key={ch.id} className="rounded-xl border bg-muted/20 overflow-hidden">
                                  {/* Account row */}
                                  <div className="flex items-center justify-between px-4 py-3">
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold truncate">{ch.name}</p>
                                      <div className="flex items-center flex-wrap gap-2 mt-1">
                                        {site && (
                                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <MapPin className="h-3 w-3" />{site.name}
                                          </span>
                                        )}
                                        <span className={`text-xs font-medium flex items-center gap-1 ${ch.isConnected ? "text-green-600" : "text-amber-600"}`}>
                                          <CheckCircle2 className="h-3 w-3" />
                                          {ch.isConnected ? "Connected" : "Not configured"}
                                        </span>
                                        {ch.phoneNumberId && (
                                          <span className="text-xs text-muted-foreground">ID: {ch.phoneNumberId}</span>
                                        )}
                                        {ch.pageId && (
                                          <span className="text-xs text-muted-foreground">Page: {ch.pageId}</span>
                                        )}
                                      </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                                      onClick={() => deleteChMutation.mutate(ch.id)}>
                                      <TrashIcon className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  {/* Secrets section */}
                                  <div className="border-t bg-muted/10 px-4 py-3 space-y-3">
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                      <ShieldCheck className="h-3 w-3" /> Integration Credentials
                                    </p>

                                    {/* Webhook URL */}
                                    <div className="space-y-1">
                                      <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Webhook URL</Label>
                                      <div className="flex items-center gap-1.5">
                                        <div className="flex-1 bg-muted/50 border rounded-lg px-3 py-2 font-mono text-xs min-w-0 truncate text-muted-foreground">
                                          {webhookUrl}
                                        </div>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" title="Copy"
                                          onClick={() => copyChField(webhookUrl, `${ch.id}-webhookUrl`)}>
                                          {chCopied === `${ch.id}-webhookUrl` ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                                        </Button>
                                      </div>
                                    </div>

                                    {/* Webhook Verify Token */}
                                    <SecretRow ch={ch} field="webhookVerifyToken" label="Webhook Verify Token"
                                      value={ch.webhookVerifyToken} canRegen={true} />

                                    {/* Access token status */}
                                    {(ch.hasAccessToken || ch.hasPageAccessToken) && (
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-0.5">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                        Access token configured
                                        <Button size="sm" variant="ghost" className="h-6 px-2 ml-auto text-xs gap-1"
                                          onClick={() => regenChMutation.mutate({ id: ch.id, field: "accessToken" })}
                                          disabled={regenChMutation.isPending && regenChMutation.variables?.id === ch.id}>
                                          <RefreshCw className="h-3 w-3" /> Regenerate token
                                        </Button>
                                      </div>
                                    )}

                                    {/* Twitter API key */}
                                    {ch.twitterApiKey && (
                                      <SecretRow ch={ch} field="twitterApiKey" label="Twitter API Key"
                                        value={ch.twitterApiKey} canRegen={false} />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </CardContent>
                        )}

                        {/* Empty state */}
                        {accounts.length === 0 && (
                          <CardContent className="pt-0 px-6 pb-5">
                            <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed bg-muted/10 text-muted-foreground">
                              <Icon className={`h-5 w-5 ${color} opacity-50`} />
                              <div className="text-sm">
                                <p className="font-medium">No {label} accounts</p>
                                <p className="text-xs mt-0.5">Click "Add Account" to connect your first {label} account.</p>
                              </div>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>

                {/* ── WhatsApp Connection Tools ──────────────────────────────── */}
                <Card className="border-[#25D366]/30 bg-[#25D366]/[0.02]">
                  <CardHeader className="pb-0 pt-4 px-5">
                    <button
                      type="button"
                      onClick={() => setWaToolsOpen((o) => !o)}
                      className="flex items-center justify-between w-full text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-[#25D366]/10 flex items-center justify-center">
                          <SiWhatsapp className="h-4 w-4 text-[#25D366]" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">WhatsApp Connection Tools</p>
                          <p className="text-xs text-muted-foreground">Generate links, QR codes &amp; website widget</p>
                        </div>
                      </div>
                      {waToolsOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  </CardHeader>

                  {waToolsOpen && (
                    <CardContent className="pt-4 px-5 pb-5 space-y-5">
                      {/* Phone + message inputs */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">WhatsApp Number</Label>
                          <Input
                            value={waPhone}
                            onChange={(e) => setWaPhone(e.target.value)}
                            placeholder="+2348012345678"
                            className="text-sm h-9"
                          />
                          <p className="text-[11px] text-muted-foreground">Include country code e.g. +234…</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Pre-filled Message <span className="text-muted-foreground">(optional)</span></Label>
                          <Input
                            value={waMessage}
                            onChange={(e) => setWaMessage(e.target.value)}
                            placeholder="Hi! I'd like to get in touch."
                            className="text-sm h-9"
                          />
                        </div>
                      </div>

                      {/* Tabs */}
                      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
                        <button
                          type="button"
                          onClick={() => setWaActiveTab("link")}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${waActiveTab === "link" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          <Link2 className="h-3.5 w-3.5" /> Link &amp; QR Code
                        </button>
                        <button
                          type="button"
                          onClick={() => setWaActiveTab("widget")}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${waActiveTab === "widget" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          <Code2 className="h-3.5 w-3.5" /> Website Widget
                        </button>
                      </div>

                      {/* LINK + QR tab */}
                      {waActiveTab === "link" && (
                        <div className="space-y-4">
                          {!waCleanPhone && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                              <SiWhatsapp className="h-4 w-4 text-[#25D366] shrink-0" />
                              Enter a WhatsApp number above to generate your link and QR code.
                            </div>
                          )}
                          {waLink && (
                            <div className="flex flex-col sm:flex-row gap-5 items-start">
                              {/* QR code */}
                              <div className="shrink-0 p-2 border rounded-xl bg-white">
                                <img
                                  src={waQrUrl}
                                  alt="WhatsApp QR Code"
                                  className="w-[160px] h-[160px] rounded"
                                />
                                <p className="text-[10px] text-center text-muted-foreground mt-1.5">Scan to open WhatsApp</p>
                              </div>
                              {/* Link + actions */}
                              <div className="flex-1 space-y-3 min-w-0">
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Click-to-Chat Link</Label>
                                  <div className="flex gap-2">
                                    <div className="flex-1 bg-muted rounded-lg px-3 py-2 text-xs font-mono break-all text-muted-foreground border">
                                      {waLink}
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="shrink-0 h-9 gap-1.5"
                                      onClick={() => copyWa(waLink, "link")}
                                    >
                                      {waCopied === "link" ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                                      {waCopied === "link" ? "Copied!" : "Copy"}
                                    </Button>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-[#25D366] text-white font-medium hover:bg-[#22c55e] transition-colors"
                                  >
                                    <SiWhatsapp className="h-3.5 w-3.5" /> Test Link
                                  </a>
                                  <a
                                    href={waQrUrl}
                                    download="whatsapp-qr.png"
                                    className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border font-medium hover:bg-muted transition-colors"
                                  >
                                    <QrCode className="h-3.5 w-3.5" /> Download QR
                                  </a>
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                  Share this link on social media, email, or your website. Customers who click it will open WhatsApp and be directed to your number with the pre-filled message.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* WIDGET tab */}
                      {waActiveTab === "widget" && (
                        <div className="space-y-4">
                          {!waCleanPhone ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                              <SiWhatsapp className="h-4 w-4 text-[#25D366] shrink-0" />
                              Enter a WhatsApp number above to generate your website widget.
                            </div>
                          ) : (
                            <>
                              {/* Preview */}
                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Preview</Label>
                                <div className="relative h-28 bg-muted/40 rounded-xl border overflow-hidden">
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <p className="text-xs text-muted-foreground">Your website content here</p>
                                  </div>
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="absolute bottom-3 right-3 flex items-center justify-center w-12 h-12 rounded-full bg-[#25D366] shadow-lg hover:scale-110 transition-transform"
                                  >
                                    <SiWhatsapp className="h-6 w-6 text-white" />
                                  </a>
                                </div>
                              </div>

                              {/* Code snippet */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs text-muted-foreground">Embed Code — paste before &lt;/body&gt; on your website</Label>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs gap-1.5"
                                    onClick={() => copyWa(waWidgetCode, "widget")}
                                  >
                                    {waCopied === "widget" ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                                    {waCopied === "widget" ? "Copied!" : "Copy Code"}
                                  </Button>
                                </div>
                                <div className="bg-zinc-950 rounded-xl p-4 overflow-x-auto">
                                  <pre className="text-[11px] text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed break-all">{waWidgetCode}</pre>
                                </div>
                              </div>

                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                This adds a floating WhatsApp button to your website. Visitors who click it are taken directly to a WhatsApp chat with your business number.
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>

                {/* Add account dialog */}
                <Dialog open={isAddChOpen} onOpenChange={setIsAddChOpen}>
                  <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Add Channel Account</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="space-y-2">
                        <Label>Channel Type</Label>
                        <Select value={addChType} onValueChange={setAddChType}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="whatsapp">WhatsApp Business</SelectItem>
                            <SelectItem value="facebook">Facebook Messenger</SelectItem>
                            <SelectItem value="instagram">Instagram Direct</SelectItem>
                            <SelectItem value="twitter">Twitter / X DM</SelectItem>
                            <SelectItem value="widget">Web Chat Widget</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Account Name</Label>
                        <Input value={addChName} onChange={(e) => setAddChName(e.target.value)} placeholder="e.g. Main WhatsApp, Branch B" />
                      </div>
                      <div className="space-y-2">
                        <Label>Assign to Site <span className="text-muted-foreground text-xs">(optional)</span></Label>
                        <Select value={addChSiteId || "__none__"} onValueChange={(v) => setAddChSiteId(v === "__none__" ? "" : v)}>
                          <SelectTrigger><SelectValue placeholder="No site assigned" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">No site</SelectItem>
                            {sites.map((s) => (
                              <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddChOpen(false)}>Cancel</Button>
                      <Button
                        disabled={!addChName || addChMutation.isPending}
                        onClick={() => addChMutation.mutate({ type: addChType, name: addChName, siteId: addChSiteId ? Number(addChSiteId) : null })}
                      >
                        {addChMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Account"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            );
          })()}

          {/* ── SITES ──────────────────────────────────────────────────────── */}
          {activeSection === "sites" && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Sites & Branches</h2>
                  <p className="text-sm text-muted-foreground mt-1">Define the physical locations or business branches for your organisation.</p>
                </div>
                <Dialog open={isSiteAddOpen} onOpenChange={setIsSiteAddOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5"><PlusIcon className="h-4 w-4" /> Add Site</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Add New Site</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="space-y-2"><Label>Site Name</Label><Input value={newSiteName} onChange={(e) => setNewSiteName(e.target.value)} placeholder="e.g. HQ Kuala Lumpur" /></div>
                      <div className="space-y-2"><Label>Description</Label><Input value={newSiteDesc} onChange={(e) => setNewSiteDesc(e.target.value)} placeholder="Optional description" /></div>
                      <div className="space-y-2"><Label>Region / City</Label><Input value={newSiteRegion} onChange={(e) => setNewSiteRegion(e.target.value)} placeholder="e.g. Selangor, Johor" /></div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsSiteAddOpen(false)}>Cancel</Button>
                      <Button
                        disabled={!newSiteName || addSiteMutation.isPending}
                        onClick={() => addSiteMutation.mutate({ name: newSiteName, description: newSiteDesc, region: newSiteRegion })}
                      >
                        {addSiteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Site"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {sites.length === 0 ? (
                <Card>
                  <CardContent className="pt-12 pb-12 flex flex-col items-center gap-3 text-center">
                    <Building2 className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No sites configured yet. Add your first site above.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {sites.map((site) => (
                    <Card key={site.id}>
                      <CardContent className="pt-4 pb-4 px-5">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 rounded-full bg-blue-600/10 flex items-center justify-center shrink-0">
                              <MapPin className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate">{site.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {[site.region, site.description].filter(Boolean).join(" · ") || "No description"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditSite(site)}>
                              <PencilIcon className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteSiteMutation.mutate(site.id)}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Edit site dialog */}
              <Dialog open={!!editSite} onOpenChange={(open) => { if (!open) setEditSite(null); }}>
                <DialogContent className="max-w-sm">
                  <DialogHeader><DialogTitle>Edit Site</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2"><Label>Site Name</Label><Input value={editSiteName} onChange={(e) => setEditSiteName(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Description</Label><Input value={editSiteDesc} onChange={(e) => setEditSiteDesc(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Region / City</Label><Input value={editSiteRegion} onChange={(e) => setEditSiteRegion(e.target.value)} /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditSite(null)}>Cancel</Button>
                    <Button
                      disabled={!editSiteName || updateSiteMutation.isPending}
                      onClick={() => editSite && updateSiteMutation.mutate({ id: editSite.id, name: editSiteName, description: editSiteDesc, region: editSiteRegion })}
                    >
                      {updateSiteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}

          {/* ── SECURITY / 2FA ─────────────────────────────────────────────── */}
          {activeSection === "security" && (
            <>
              <div>
                <h2 className="text-xl font-bold">Security</h2>
                <p className="text-sm text-muted-foreground mt-1">Manage two-factor authentication to protect your account.</p>
              </div>

              {/* Status + action card */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${twoFaStatus?.totpEnabled ? "bg-green-100" : "bg-muted"}`}>
                        <ShieldCheck className={`h-5 w-5 ${twoFaStatus?.totpEnabled ? "text-green-600" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <CardTitle className="text-base">Authenticator App (TOTP)</CardTitle>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {twoFaStatus?.totpEnabled
                            ? "Two-factor authentication is active — your account is protected."
                            : "Use Google Authenticator or any TOTP app for a second login step."}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${twoFaStatus?.totpEnabled ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {twoFaStatus?.totpEnabled ? "Enabled" : "Not enabled"}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5">

                  {/* ── IDLE state ── */}
                  {twoFaStep === "idle" && !twoFaStatus?.totpEnabled && (
                    <div className="space-y-5">
                      {/* Supported apps */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Works with any TOTP authenticator app</p>
                        <div className="grid grid-cols-3 gap-3">
                          {/* Google Authenticator */}
                          <a href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2" target="_blank" rel="noopener noreferrer"
                             className="flex flex-col items-center gap-2 p-3 rounded-xl border bg-muted/30 hover:bg-muted/60 transition-colors group">
                            <div className="h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center border">
                              <svg viewBox="0 0 48 48" className="h-6 w-6">
                                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                              </svg>
                            </div>
                            <div className="text-center">
                              <p className="text-xs font-medium leading-tight">Google</p>
                              <p className="text-xs font-medium leading-tight">Authenticator</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5 group-hover:text-primary transition-colors">Download →</p>
                            </div>
                          </a>

                          {/* Authy */}
                          <a href="https://authy.com/download/" target="_blank" rel="noopener noreferrer"
                             className="flex flex-col items-center gap-2 p-3 rounded-xl border bg-muted/30 hover:bg-muted/60 transition-colors group">
                            <div className="h-10 w-10 rounded-xl bg-[#EC1C24] flex items-center justify-center shadow-sm">
                              <SiAuthy className="h-5 w-5 text-white" />
                            </div>
                            <div className="text-center">
                              <p className="text-xs font-medium leading-tight">Twilio Authy</p>
                              <p className="text-xs text-muted-foreground leading-tight">Multi-device</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5 group-hover:text-primary transition-colors">Download →</p>
                            </div>
                          </a>

                          {/* Microsoft Authenticator */}
                          <a href="https://www.microsoft.com/en-us/security/mobile-authenticator-app" target="_blank" rel="noopener noreferrer"
                             className="flex flex-col items-center gap-2 p-3 rounded-xl border bg-muted/30 hover:bg-muted/60 transition-colors group">
                            <div className="h-10 w-10 rounded-xl bg-[#00A4EF] flex items-center justify-center shadow-sm">
                              <svg viewBox="0 0 21 21" className="h-5 w-5" fill="white">
                                <rect x="1" y="1" width="9" height="9"/>
                                <rect x="11" y="1" width="9" height="9"/>
                                <rect x="1" y="11" width="9" height="9"/>
                                <rect x="11" y="11" width="9" height="9"/>
                              </svg>
                            </div>
                            <div className="text-center">
                              <p className="text-xs font-medium leading-tight">Microsoft</p>
                              <p className="text-xs text-muted-foreground leading-tight">Authenticator</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5 group-hover:text-primary transition-colors">Download →</p>
                            </div>
                          </a>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-2">Any other TOTP-compatible app (1Password, Bitwarden, etc.) also works.</p>
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Ready to set up?</p>
                          <p className="text-xs text-muted-foreground mt-0.5">You'll scan a QR code with your chosen app to link it to your account.</p>
                        </div>
                        <Button onClick={startTwoFaSetup} disabled={twoFaLoading} className="gap-2 shrink-0">
                          {twoFaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                          Set up 2FA
                        </Button>
                      </div>
                    </div>
                  )}

                  {twoFaStep === "idle" && twoFaStatus?.totpEnabled && (
                    <div className="space-y-4">
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                        <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-green-800">Your account is protected</p>
                          <p className="text-green-700 mt-0.5">Every login requires a time-based one-time code from your authenticator app in addition to your password.</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <p className="text-sm text-muted-foreground">Want to remove 2FA from your account?</p>
                        <Button variant="destructive" size="sm" onClick={() => { setTwoFaStep("disable"); setTwoFaCode(""); setTwoFaError(""); }}>
                          Disable 2FA
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ── SETUP: guided 3-step flow ── */}
                  {twoFaStep === "setup" && (
                    <div className="space-y-6">
                      {/* Step indicators */}
                      <div className="flex items-center gap-0">
                        {["Download app", "Scan QR code", "Verify code"].map((label, i) => (
                          <div key={i} className="flex items-center flex-1">
                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                {i + 1}
                              </div>
                              <span className={`text-xs font-medium ${i < 2 ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                            </div>
                            {i < 2 && <div className="flex-1 h-px bg-border mx-2" />}
                          </div>
                        ))}
                      </div>

                      {/* QR + instructions */}
                      <div className="flex flex-col sm:flex-row gap-6 items-start">
                        <div className="shrink-0 p-2 bg-white border rounded-xl shadow-sm">
                          {twoFaQr && (
                            <img src={twoFaQr} alt="2FA QR Code" className="w-44 h-44 rounded" />
                          )}
                          <p className="text-[10px] text-center text-muted-foreground mt-1.5">Scan with your app</p>
                        </div>
                        <div className="flex-1 space-y-4 text-sm">
                          <div>
                            <p className="font-semibold text-base">Open your authenticator app and scan this QR code</p>
                            <p className="text-muted-foreground mt-1">In Google Authenticator, Authy, or Microsoft Authenticator: tap the <strong>+</strong> button and choose <strong>Scan a QR code</strong>.</p>
                          </div>
                          {twoFaSecret && (
                            <div className="bg-muted rounded-lg p-3 space-y-1">
                              <p className="text-xs text-muted-foreground font-medium">Can't scan? Enter this key manually in your app:</p>
                              <div className="flex items-center gap-2">
                                <code className="text-xs font-mono tracking-widest break-all flex-1">{twoFaSecret}</code>
                                <Button size="sm" variant="ghost" className="h-7 px-2 shrink-0"
                                  onClick={() => navigator.clipboard.writeText(twoFaSecret!)}>
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                          <div className="flex gap-2 flex-wrap">
                            <a href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2" target="_blank" rel="noopener noreferrer"
                               className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border hover:bg-muted transition-colors">
                              <svg viewBox="0 0 48 48" className="h-3.5 w-3.5"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                              Google Authenticator
                            </a>
                            <a href="https://authy.com/download/" target="_blank" rel="noopener noreferrer"
                               className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border hover:bg-muted transition-colors">
                              <SiAuthy className="h-3.5 w-3.5 text-[#EC1C24]" /> Authy
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Code verification */}
                      <div className="bg-muted/40 rounded-xl p-4 space-y-3">
                        <div>
                          <p className="text-sm font-semibold">Enter the 6-digit code from your app</p>
                          <p className="text-xs text-muted-foreground mt-0.5">The code refreshes every 30 seconds — enter the current one shown in your app.</p>
                        </div>
                        <div className="flex gap-3 items-center">
                          <Input
                            value={twoFaCode}
                            onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            placeholder="000 000"
                            className="w-36 font-mono text-center text-xl tracking-[0.4em] h-11"
                            maxLength={6}
                            autoFocus
                            onKeyDown={(e) => e.key === "Enter" && enableTwoFa()}
                          />
                          <Button onClick={enableTwoFa} disabled={twoFaCode.length !== 6 || twoFaLoading} className="gap-2 h-11 px-5">
                            {twoFaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            Verify &amp; Enable
                          </Button>
                          <Button variant="ghost" onClick={() => { setTwoFaStep("idle"); setTwoFaQr(null); setTwoFaSecret(null); setTwoFaCode(""); setTwoFaError(""); }}>
                            Cancel
                          </Button>
                        </div>
                        {twoFaError && (
                          <div className="flex items-center gap-2 text-sm text-destructive">
                            <XCircle className="h-4 w-4 shrink-0" /> {twoFaError}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── DISABLE: confirm with current code ── */}
                  {twoFaStep === "disable" && (
                    <div className="space-y-4">
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                        <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-destructive">Disabling 2FA reduces account security</p>
                          <p className="text-muted-foreground mt-0.5">Enter your current 6-digit authenticator code to confirm you still have access to your app before disabling.</p>
                        </div>
                      </div>
                      <div className="flex gap-3 items-center">
                        <Input
                          value={twoFaCode}
                          onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          placeholder="000 000"
                          className="w-36 font-mono text-center text-xl tracking-[0.4em] h-11"
                          maxLength={6}
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && disableTwoFa()}
                        />
                        <Button variant="destructive" onClick={disableTwoFa} disabled={twoFaCode.length !== 6 || twoFaLoading} className="gap-2 h-11">
                          {twoFaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Confirm Disable
                        </Button>
                        <Button variant="ghost" onClick={() => { setTwoFaStep("idle"); setTwoFaCode(""); setTwoFaError(""); }}>
                          Cancel
                        </Button>
                      </div>
                      {twoFaError && (
                        <div className="flex items-center gap-2 text-sm text-destructive">
                          <XCircle className="h-4 w-4 shrink-0" /> {twoFaError}
                        </div>
                      )}
                    </div>
                  )}
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
                  <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="space-y-2"><Label>Full Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Sarah Mitchell" /></div>
                      <div className="space-y-2"><Label>Email Address</Label><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="sarah@commscrm.com" /></div>
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

                      {/* ── Site Assignment ── */}
                      {sites.length > 0 && (
                        <div className="space-y-2">
                          <Label>Assigned Sites <span className="text-muted-foreground text-xs">(optional)</span></Label>
                          <div className="border rounded-lg p-3 space-y-2">
                            {sites.map((s) => (
                              <div key={s.id} className="flex items-center gap-2">
                                <Checkbox
                                  id={`new-site-${s.id}`}
                                  checked={newAgentSiteIds.includes(s.id)}
                                  onCheckedChange={(v) => setNewAgentSiteIds(v ? [...newAgentSiteIds, s.id] : newAgentSiteIds.filter((id) => id !== s.id))}
                                />
                                <label htmlFor={`new-site-${s.id}`} className="text-sm cursor-pointer flex items-center gap-1.5">
                                  <MapPin className="h-3 w-3 text-muted-foreground" />{s.name}
                                  {s.region && <span className="text-xs text-muted-foreground">({s.region})</span>}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── Menu Permissions ── */}
                      <div className="border rounded-lg p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">Menu Permissions</p>
                            <p className="text-xs text-muted-foreground">Control which pages this user can access</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{newCustomPerms ? "Custom" : "Full Access"}</span>
                            <Switch checked={newCustomPerms} onCheckedChange={(v) => {
                              setNewCustomPerms(v);
                              if (v) setNewAllowedMenus([...ALL_MENUS.map((m) => m.slug)]);
                            }} />
                          </div>
                        </div>

                        {newCustomPerms && (
                          <div className="space-y-3 pt-1">
                            {MENU_GROUPS.map((group) => {
                              const groupMenus = ALL_MENUS.filter((m) => m.group === group);
                              const allChecked = groupMenus.every((m) => newAllowedMenus.includes(m.slug));
                              const someChecked = groupMenus.some((m) => newAllowedMenus.includes(m.slug));
                              return (
                                <div key={group}>
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <Checkbox
                                      id={`new-group-${group}`}
                                      checked={allChecked}
                                      className={someChecked && !allChecked ? "data-[state=unchecked]:bg-primary/20" : ""}
                                      onCheckedChange={(v) => setNewAllowedMenus(toggleGroupAll(newAllowedMenus, group, !!v))}
                                    />
                                    <label htmlFor={`new-group-${group}`} className="text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer">{group}</label>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1 pl-6">
                                    {groupMenus.map((m) => (
                                      <div key={m.slug} className="flex items-center gap-2">
                                        <Checkbox
                                          id={`new-${m.slug}`}
                                          checked={newAllowedMenus.includes(m.slug)}
                                          onCheckedChange={() => setNewAllowedMenus(toggleMenu(newAllowedMenus, m.slug))}
                                        />
                                        <label htmlFor={`new-${m.slug}`} className="text-sm cursor-pointer">{m.name}</label>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                            <p className="text-xs text-muted-foreground pt-1">
                              {newAllowedMenus.length} of {ALL_MENUS.length} pages selected
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                      <Button
                        disabled={!newName || !newEmail || !newPassword || addAgentMutation.isPending}
                        onClick={() => addAgentMutation.mutate({
                          name: newName,
                          email: newEmail,
                          password: newPassword,
                          role: newRole,
                          allowedMenus: newCustomPerms ? newAllowedMenus : null,
                          siteIds: newAgentSiteIds.length > 0 ? newAgentSiteIds : null,
                        })}
                      >
                        {addAgentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add User"}
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
                              {agent.siteIds && agent.siteIds.length > 0 && (
                                <div className="flex items-center gap-1 mt-1 flex-wrap">
                                  {agent.siteIds.map((sid) => {
                                    const site = sites.find((s) => s.id === sid);
                                    return site ? (
                                      <span key={sid} className="inline-flex items-center gap-0.5 text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5 border border-blue-200">
                                        <MapPin className="h-2.5 w-2.5" />{site.name}
                                      </span>
                                    ) : null;
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Select defaultValue={agent.role} onValueChange={(val) => updateAgentMutation.mutate({ id: agent.id, role: val })}>
                              <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="supervisor">Supervisor</SelectItem>
                                <SelectItem value="agent">Agent</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5 text-xs"
                              onClick={() => openPermEdit(agent)}
                              title="Edit menu permissions"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              {agent.allowedMenus === null ? "Full Access" : `${agent.allowedMenus.length} pages`}
                            </Button>
                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-8 w-8" disabled={agent.id === currentAgent?.id}>
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

          {/* ── EDIT PERMISSIONS DIALOG ────────────────────────────────────── */}
          <Dialog open={!!permEditAgent} onOpenChange={(open) => { if (!open) setPermEditAgent(null); }}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Menu Permissions</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose which pages <strong>{permEditAgent?.name}</strong> can access.
                </p>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <p className="text-sm font-medium">{permCustom ? "Custom permissions" : "Full access — all pages"}</p>
                    <p className="text-xs text-muted-foreground">Toggle to restrict specific pages</p>
                  </div>
                  <Switch checked={permCustom} onCheckedChange={(v) => {
                    setPermCustom(v);
                    if (v) setPermMenus([...ALL_MENUS.map((m) => m.slug)] as MenuSlug[]);
                  }} />
                </div>

                {permCustom && (
                  <div className="space-y-3">
                    {MENU_GROUPS.map((group) => {
                      const groupMenus = ALL_MENUS.filter((m) => m.group === group);
                      const allChecked = groupMenus.every((m) => permMenus.includes(m.slug as MenuSlug));
                      const someChecked = groupMenus.some((m) => permMenus.includes(m.slug as MenuSlug));
                      return (
                        <div key={group} className="border rounded-md p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Checkbox
                              id={`perm-group-${group}`}
                              checked={allChecked}
                              className={someChecked && !allChecked ? "opacity-70" : ""}
                              onCheckedChange={(v) => setPermMenus(toggleGroupAll(permMenus, group, !!v) as MenuSlug[])}
                            />
                            <label htmlFor={`perm-group-${group}`} className="text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer">{group}</label>
                            <Badge variant="secondary" className="ml-auto text-xs">
                              {groupMenus.filter((m) => permMenus.includes(m.slug as MenuSlug)).length}/{groupMenus.length}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 pl-6">
                            {groupMenus.map((m) => (
                              <div key={m.slug} className="flex items-center gap-2">
                                <Checkbox
                                  id={`perm-${m.slug}`}
                                  checked={permMenus.includes(m.slug as MenuSlug)}
                                  onCheckedChange={() => setPermMenus(toggleMenu(permMenus, m.slug as MenuSlug))}
                                />
                                <label htmlFor={`perm-${m.slug}`} className="text-sm cursor-pointer">{m.name}</label>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-xs text-muted-foreground">
                      {permMenus.length} of {ALL_MENUS.length} pages selected
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPermEditAgent(null)}>Cancel</Button>
                <Button
                  disabled={updateMenusMutation.isPending}
                  onClick={() => permEditAgent && updateMenusMutation.mutate({
                    id: permEditAgent.id,
                    allowedMenus: permCustom ? permMenus : null,
                  })}
                >
                  {updateMenusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Permissions"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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

          {/* ── PAYMENTS ─────────────────────────────────────────────────── */}
          {activeSection === "payments" && (() => {
            const PROVIDERS: {
              id: PaymentProvider; label: string; subtitle: string;
              color: string; bg: string; borderColor: string;
              publicKeyLabel: string; secretKeyLabel: string;
              logo: React.ReactNode;
              docs: string;
            }[] = [
              {
                id: "stripe", label: "Stripe", subtitle: "Global card payments",
                color: "text-[#635BFF]", bg: "bg-[#635BFF]/10", borderColor: "border-[#635BFF]/20",
                publicKeyLabel: "Publishable Key (pk_...)", secretKeyLabel: "Secret Key (sk_...)",
                logo: (
                  <svg viewBox="0 0 60 25" className="h-5 w-14 fill-[#635BFF]">
                    <path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a8.33 8.33 0 0 1-4.56 1.1c-4.01 0-6.83-2.5-6.83-7.48 0-4.19 2.39-7.52 6.3-7.52 3.92 0 5.96 3.28 5.96 7.5 0 .4-.04 1.26-.06 1.48zm-5.92-5.62c-1.03 0-2.17.73-2.17 2.58h4.25c0-1.85-1.07-2.58-2.08-2.58zM40.95 20.3c-1.44 0-2.32-.6-2.9-1.04l-.02 4.63-4.45.94V5.82h3.94l.04 1.3c.57-.7 1.62-1.5 3.23-1.5 2.88 0 5.49 2.3 5.49 7.26 0 5.55-2.55 7.42-5.33 7.42zM40 9.4c-.95 0-1.54.34-1.97.81l.02 6.12c.4.44.98.78 1.95.78 1.52 0 2.54-1.65 2.54-3.87 0-2.15-1.04-3.84-2.54-3.84zM28.24 5.82h4.47v14.1h-4.47V5.82zm-.11-4.7a2.6 2.6 0 1 1 5.2.04 2.6 2.6 0 0 1-5.2-.04zM18.09 7.08l-.28-1.26h-3.8v14.1h4.43V11.4c1.05-1.4 2.83-1.14 3.38-.95V5.81c-.56-.2-2.61-.5-3.73 1.27zM9.56 5.56a9.5 9.5 0 0 0-5.02 1.22L2.68 2.44A15.24 15.24 0 0 1 9.56 1c2.9 0 4.9 1.34 4.9 4.77v14.15h-3.9l-.05-1.22c-.6.8-1.58 1.5-3.35 1.5C4.97 20.2 2.5 18.45 2.5 15c0-3.7 2.56-5.43 6.49-5.64l.5-.03V7.62c0-.62-.2-2.06-1.93-2.06zm-.55 6.72c-1.32.07-2.28.54-2.28 1.99 0 1.04.6 1.7 1.63 1.7.53 0 1.15-.16 1.63-.46l.02-3.2-.56.03c-.16.01-.32.02-.44.03v-.09z"/>
                  </svg>
                ),
                docs: "https://dashboard.stripe.com/apikeys",
              },
              {
                id: "paystack", label: "Paystack", subtitle: "Africa's leading gateway",
                color: "text-[#00C3F7]", bg: "bg-[#00C3F7]/10", borderColor: "border-[#00C3F7]/20",
                publicKeyLabel: "Public Key (pk_...)", secretKeyLabel: "Secret Key (sk_...)",
                logo: (
                  <div className="flex items-center gap-1.5">
                    <div className="h-6 w-6 rounded-full bg-[#00C3F7] flex items-center justify-center shrink-0">
                      <span className="text-white text-xs font-black">P</span>
                    </div>
                    <span className="font-bold text-sm text-[#00C3F7]">Paystack</span>
                  </div>
                ),
                docs: "https://dashboard.paystack.com/#/settings/developer",
              },
              {
                id: "flutterwave", label: "Flutterwave", subtitle: "Pan-African payments",
                color: "text-[#F5A623]", bg: "bg-[#F5A623]/10", borderColor: "border-[#F5A623]/20",
                publicKeyLabel: "Public Key (FLWPUBK-...)", secretKeyLabel: "Secret Key (FLWSECK-...)",
                logo: (
                  <div className="flex items-center gap-1.5">
                    <div className="h-6 w-6 rounded-full bg-[#F5A623] flex items-center justify-center shrink-0">
                      <span className="text-white text-xs font-black">F</span>
                    </div>
                    <span className="font-bold text-sm text-[#F5A623]">Flutterwave</span>
                  </div>
                ),
                docs: "https://developer.flutterwave.com/docs",
              },
              {
                id: "paypal", label: "PayPal", subtitle: "Global digital wallet",
                color: "text-[#003087]", bg: "bg-[#003087]/10", borderColor: "border-[#003087]/20",
                publicKeyLabel: "Client ID", secretKeyLabel: "Client Secret",
                logo: (
                  <div className="flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.26-.58 2.975-2.553 4.966-5.634 5.456l-.028.004a7.25 7.25 0 0 1-1.074.07h-2.19l-.942 5.97H14.8c.46 0 .85-.332.922-.786l.037-.216 1.088-6.882.028-.153c.072-.454.462-.787.923-.787h.577c3.8 0 6.772-1.548 7.641-6.027.361-1.848.175-3.41-.794-4.368z" fill="#009CDE"/>
                    </svg>
                    <span className="font-bold text-sm text-[#003087]">PayPal</span>
                  </div>
                ),
                docs: "https://developer.paypal.com/api/rest/",
              },
              {
                id: "square", label: "Square", subtitle: "POS & online payments",
                color: "text-[#3E4348]", bg: "bg-[#3E4348]/10", borderColor: "border-[#3E4348]/20",
                publicKeyLabel: "Application ID", secretKeyLabel: "Access Token",
                logo: (
                  <div className="flex items-center gap-1.5">
                    <div className="h-6 w-6 rounded bg-[#3E4348] flex items-center justify-center shrink-0">
                      <span className="text-white text-xs font-black">Sq</span>
                    </div>
                    <span className="font-bold text-sm text-[#3E4348]">Square</span>
                  </div>
                ),
                docs: "https://developer.squareup.com/docs",
              },
            ];

            return (
              <>
                <div>
                  <h2 className="text-xl font-bold">Payment Gateways</h2>
                  <p className="text-sm text-muted-foreground mt-1">Connect payment platforms to send payment links to customers and receive payments through your CRM.</p>
                </div>

                {/* Summary bar */}
                <div className="flex flex-wrap gap-3">
                  {PROVIDERS.map(({ id, label, color }) => {
                    const cfg = getPayCfg(id);
                    return (
                      <div key={id} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${cfg.isEnabled ? "bg-green-50 border-green-200 text-green-700" : "bg-muted/40 border-border text-muted-foreground"}`}>
                        <div className={`h-2 w-2 rounded-full ${cfg.isEnabled ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                        {label}
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-4">
                  {PROVIDERS.map(({ id, label, subtitle, color, bg, borderColor, publicKeyLabel, secretKeyLabel, logo, docs }) => {
                    const cfg = getPayCfg(id);
                    const edits = getPayEdit(id);
                    const pubKey = edits.publicKey !== undefined ? edits.publicKey : (cfg.publicKey ?? "");
                    const secKey = edits.secretKey !== undefined ? edits.secretKey : "";
                    const isEnabled = edits.isEnabled !== undefined ? edits.isEnabled : cfg.isEnabled;
                    const isLiveMode = edits.isLiveMode !== undefined ? edits.isLiveMode : cfg.isLiveMode;
                    const webhookUrl = cfg.webhookToken
                      ? `${window.location.origin.replace(/:\d+/, ":3002")}/api/webhooks/payment/${id}/${cfg.webhookToken}`
                      : "Save configuration to generate webhook URL";
                    const testRes = payTestResult[id];
                    const isTesting = !!payTestLoading[id];
                    const isSaving = savePayMutation.isPending && (savePayMutation.variables as any)?.provider === id;
                    const revealSec = !!payReveal[`${id}-secret`];

                    return (
                      <Card key={id} className={`overflow-hidden border-l-4 ${borderColor}`}>
                        <CardHeader className="pb-4 pt-5 px-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className={`h-12 w-12 rounded-xl ${bg} flex items-center justify-center shrink-0 border ${borderColor}`}>
                                <CreditCard className={`h-6 w-6 ${color}`} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  {logo}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              {/* Live / Test toggle */}
                              <div className="flex items-center gap-2 text-xs">
                                <span className={!isLiveMode ? "font-semibold text-amber-600" : "text-muted-foreground"}>Test</span>
                                <button
                                  type="button"
                                  className={`relative w-10 h-5 rounded-full transition-colors ${isLiveMode ? "bg-green-500" : "bg-amber-400"}`}
                                  onClick={() => setPayField(id, "isLiveMode", !isLiveMode)}
                                >
                                  <span className={`absolute top-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform ${isLiveMode ? "translate-x-5" : "translate-x-0.5"}`} />
                                </button>
                                <span className={isLiveMode ? "font-semibold text-green-600" : "text-muted-foreground"}>Live</span>
                              </div>
                              {/* Enable / Disable */}
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Enabled</span>
                                <button
                                  type="button"
                                  className={`relative w-10 h-5 rounded-full transition-colors ${isEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}
                                  onClick={() => setPayField(id, "isEnabled", !isEnabled)}
                                >
                                  <span className={`absolute top-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform ${isEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="pt-0 px-6 pb-5 space-y-4">
                          <Separator />

                          {/* Keys */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs">{publicKeyLabel}</Label>
                              <Input
                                value={pubKey}
                                onChange={(e) => setPayField(id, "publicKey", e.target.value)}
                                placeholder={id === "paypal" ? "AXxx..." : id === "square" ? "sq0idp-..." : `${id === "stripe" ? "pk_" : id === "paystack" || id === "flutterwave" ? "pk_" : "key_"}...`}
                                className="text-xs font-mono h-9"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">{secretKeyLabel}</Label>
                              <div className="flex gap-1.5">
                                <Input
                                  type={revealSec ? "text" : "password"}
                                  value={secKey}
                                  onChange={(e) => setPayField(id, "secretKey", e.target.value)}
                                  placeholder={cfg.hasSecretKey ? "••••••••••••••••••••" : "Enter secret key..."}
                                  className="text-xs font-mono h-9 flex-1"
                                />
                                <Button size="icon" variant="outline" className="h-9 w-9 shrink-0"
                                  onClick={() => setPayReveal((p) => ({ ...p, [`${id}-secret`]: !revealSec }))}>
                                  {revealSec ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </Button>
                              </div>
                              {cfg.hasSecretKey && !secKey && (
                                <p className="text-[11px] text-green-600 flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> Key saved — enter a new one to update
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Webhook URL */}
                          {cfg.webhookToken && (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Webhook URL <span className="text-muted-foreground">(paste this in your {label} dashboard)</span></Label>
                                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1"
                                  onClick={() => regenPayWebhookMutation.mutate(id)}
                                  disabled={regenPayWebhookMutation.isPending}>
                                  <RefreshCw className="h-3 w-3" /> Regenerate
                                </Button>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="flex-1 bg-muted/50 border rounded-lg px-3 py-2 font-mono text-[11px] text-muted-foreground truncate">
                                  {webhookUrl}
                                </div>
                                <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0"
                                  onClick={() => copyPay(webhookUrl, `${id}-webhook`)}>
                                  {payCopied === `${id}-webhook` ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Test result */}
                          {testRes && (
                            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${testRes.success ? "bg-green-50 border border-green-200 text-green-800" : "bg-destructive/5 border border-destructive/20 text-destructive"}`}>
                              {testRes.success ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                              {testRes.message}
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <Button
                              onClick={() => savePayMutation.mutate({ provider: id, data: { isEnabled, isLiveMode, publicKey: pubKey || null, ...(secKey ? { secretKey: secKey } : {}) } })}
                              disabled={isSaving}
                              size="sm" className="gap-1.5"
                            >
                              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                              Save
                            </Button>
                            <Button
                              variant="outline" size="sm" className="gap-1.5"
                              onClick={() => testPayConnection(id)}
                              disabled={isTesting || (!cfg.hasSecretKey && !secKey)}
                            >
                              {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube2 className="h-3.5 w-3.5" />}
                              Test Connection
                            </Button>
                            <a href={docs} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                              <Globe className="h-3.5 w-3.5" /> {label} Docs →
                            </a>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Info panel */}
                <Card className="bg-muted/30">
                  <CardContent className="pt-5 pb-5">
                    <div className="flex gap-3">
                      <Banknote className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="text-sm space-y-1">
                        <p className="font-medium">How payment integration works</p>
                        <p className="text-muted-foreground">Once configured, agents can generate payment links directly from any customer conversation, track payment status in real time, and receive webhook notifications when payments are completed.</p>
                        <p className="text-muted-foreground mt-1">Use <strong>Test mode</strong> while setting up. Switch to <strong>Live mode</strong> once your integration is verified end-to-end.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            );
          })()}

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
