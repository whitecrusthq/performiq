import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, XCircle, Plus, Copy, ExternalLink, Loader2, Trash2,
  MessageSquare, AlertCircle, Mail, Save, Eye, EyeOff, Globe, Twitter,
  ChevronRight, Settings2, Zap, Check, RefreshCw,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type ChannelType = "whatsapp" | "facebook" | "instagram" | "twitter" | "widget" | "email";

interface ApiChannel {
  id: number;
  type: ChannelType;
  name: string;
  isConnected: boolean;
  webhookVerifyToken: string;
  phoneNumberId: string | null;
  wabaId: string | null;
  pageId: string | null;
  instagramAccountId: string | null;
  twitterApiKey: string | null;
  hasAccessToken: boolean;
  hasPageAccessToken: boolean;
  hasTwitterCreds: boolean;
  metadata: Record<string, unknown> | null;
}

// ── Channel Icons ─────────────────────────────────────────────────────────────
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.557 4.123 1.529 5.855L.057 23.885a.5.5 0 0 0 .611.612l6.101-1.524A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.877 0-3.659-.506-5.191-1.393l-.371-.218-3.844.96.96-3.787-.231-.382A10 10 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

// ── Channel metadata ──────────────────────────────────────────────────────────
const CHANNEL_META = {
  whatsapp: {
    label: "WhatsApp Business",
    shortLabel: "WhatsApp",
    color: "#25D366",
    bgClass: "bg-[#25D366]",
    lightBg: "bg-green-50 dark:bg-green-950/20",
    border: "border-green-200 dark:border-green-900",
    textColor: "text-green-700 dark:text-green-400",
    description: "Receive and send WhatsApp messages via Meta's WhatsApp Business API",
    docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started",
    fields: [
      { key: "accessToken",   label: "System User Access Token", placeholder: "EAAxxxxxx…",  type: "password" as const, description: "Permanent token from Meta Business Manager" },
      { key: "phoneNumberId", label: "Phone Number ID",          placeholder: "1234567890",  type: "text"     as const, description: "From your WhatsApp Business Phone Number settings" },
      { key: "wabaId",        label: "WhatsApp Business Account ID", placeholder: "9876543210", type: "text" as const, description: "Your WABA ID from Meta Business Manager" },
    ],
  },
  facebook: {
    label: "Facebook Messenger",
    shortLabel: "Facebook",
    color: "#1877F2",
    bgClass: "bg-[#1877F2]",
    lightBg: "bg-blue-50 dark:bg-blue-950/20",
    border: "border-blue-200 dark:border-blue-900",
    textColor: "text-blue-700 dark:text-blue-400",
    description: "Connect your Facebook Page to receive and send Messenger messages",
    docsUrl: "https://developers.facebook.com/docs/messenger-platform/get-started",
    fields: [
      { key: "pageAccessToken", label: "Page Access Token", placeholder: "EAAxxxxxx…", type: "password" as const, description: "Page Access Token from your Facebook App" },
      { key: "pageId",          label: "Facebook Page ID",  placeholder: "1234567890", type: "text"     as const, description: "Your Facebook Page ID" },
    ],
  },
  instagram: {
    label: "Instagram Direct",
    shortLabel: "Instagram",
    color: "#E1306C",
    bgClass: "bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#F77737]",
    lightBg: "bg-pink-50 dark:bg-pink-950/20",
    border: "border-pink-200 dark:border-pink-900",
    textColor: "text-pink-700 dark:text-pink-400",
    description: "Receive Instagram Direct Messages from your business account",
    docsUrl: "https://developers.facebook.com/docs/messenger-platform/instagram",
    fields: [
      { key: "pageAccessToken",       label: "Page Access Token",       placeholder: "EAAxxxxxx…", type: "password" as const, description: "Page Access Token with Instagram permissions" },
      { key: "instagramAccountId",    label: "Instagram Account ID",    placeholder: "1234567890", type: "text"     as const, description: "Your Instagram Business Account ID" },
    ],
  },
  twitter: {
    label: "Twitter / X",
    shortLabel: "Twitter / X",
    color: "#000000",
    bgClass: "bg-black",
    lightBg: "bg-neutral-50 dark:bg-neutral-950/20",
    border: "border-neutral-200 dark:border-neutral-800",
    textColor: "text-neutral-800 dark:text-neutral-200",
    description: "Connect your Twitter/X account to receive and reply to DMs and mentions",
    docsUrl: "https://developer.twitter.com/en/portal/dashboard",
    fields: [
      { key: "twitterApiKey",           label: "API Key (Consumer Key)",     placeholder: "xxxxxx…", type: "text"     as const, description: "From Twitter Developer App → Keys and Tokens" },
      { key: "twitterApiSecret",        label: "API Secret",                 placeholder: "xxxxxx…", type: "password" as const, description: "Consumer Secret from your Twitter Developer App" },
      { key: "twitterBearerToken",      label: "Bearer Token",               placeholder: "AAAAAA…", type: "password" as const, description: "Bearer Token for app-only authentication" },
      { key: "twitterAccessToken",      label: "Access Token",               placeholder: "xxxxxx…", type: "text"     as const, description: "Access Token for your Twitter account" },
      { key: "twitterAccessTokenSecret",label: "Access Token Secret",        placeholder: "xxxxxx…", type: "password" as const, description: "Access Token Secret for your Twitter account" },
    ],
  },
  widget: {
    label: "Website Widget",
    shortLabel: "Website Widget",
    color: "#7C3AED",
    bgClass: "bg-violet-600",
    lightBg: "bg-violet-50 dark:bg-violet-950/20",
    border: "border-violet-200 dark:border-violet-900",
    textColor: "text-violet-700 dark:text-violet-400",
    description: "Embed a live chat bubble on your website — visitors chat directly into your CommsCRM inbox",
    docsUrl: "https://docs.example.com/widget",
    fields: [] as { key: string; label: string; placeholder: string; type: "text" | "password"; description: string }[],
  },
  email: {
    label: "Email",
    shortLabel: "Email",
    color: "#6366F1",
    bgClass: "bg-indigo-500",
    lightBg: "bg-indigo-50 dark:bg-indigo-950/20",
    border: "border-indigo-200 dark:border-indigo-900",
    textColor: "text-indigo-700 dark:text-indigo-400",
    description: "Receive and send emails through your unified CommsCRM inbox via SMTP & IMAP",
    docsUrl: "https://support.google.com/mail/answer/7126229",
    fields: [] as { key: string; label: string; placeholder: string; type: "text" | "password"; description: string }[],
  },
} as const;

type ChannelKey = keyof typeof CHANNEL_META;

// ── Channel icon component ─────────────────────────────────────────────────────
function ChannelIcon({ type, size = "md" }: { type: ChannelKey; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-7 w-7" : "h-5 w-5";
  const wrapSz = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-12 w-12" : "h-9 w-9";
  const meta = CHANNEL_META[type];
  return (
    <div className={`${wrapSz} rounded-xl ${meta.bgClass} flex items-center justify-center text-white shrink-0`}>
      {type === "whatsapp"  && <WhatsAppIcon className={sz} />}
      {type === "facebook"  && <FacebookIcon className={sz} />}
      {type === "instagram" && <InstagramIcon className={sz} />}
      {type === "twitter"   && <Twitter className={sz} />}
      {type === "widget"    && <Globe className={sz} />}
      {type === "email"     && <Mail className={sz} />}
    </div>
  );
}

// ── Masked credential field ───────────────────────────────────────────────────
function MaskedField({ label, value, hint, onCopy }: { label: string; value: string; hint?: string; onCopy: () => void }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const masked = "•".repeat(Math.min(value.length, 32));

  function handleCopy() {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <div className={`h-9 w-full rounded-lg border bg-muted/40 px-3 flex items-center text-sm font-mono ${visible ? "text-foreground" : "text-muted-foreground"} overflow-hidden`}>
            <span className="truncate">{visible ? value : masked}</span>
          </div>
        </div>
        <button
          onClick={() => setVisible((v) => !v)}
          title={visible ? "Hide" : "Reveal"}
          className="h-9 w-9 flex items-center justify-center rounded-lg border bg-background hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
        >
          {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={handleCopy}
          title="Copy"
          className="h-9 w-9 flex items-center justify-center rounded-lg border bg-background hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ── Channel card (connected) ──────────────────────────────────────────────────
function ChannelCard({ channel, onEdit }: { channel: ApiChannel; onEdit: (c: ApiChannel) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const meta = CHANNEL_META[channel.type as ChannelKey];

  const deleteMutation = useMutation({
    mutationFn: () => apiDelete(`/channels/${channel.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channels"] });
      toast({ title: "Channel removed" });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () => apiPost(`/channels/${channel.id}/regenerate`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channels"] });
      toast({ title: "Token regenerated", description: "Your new token has been generated. Update your webhook settings." });
    },
    onError: () => toast({ title: "Failed to regenerate token", variant: "destructive" }),
  });

  const backendUrl = window.location.origin.replace(/\/crm.*/, "");
  const webhookUrl = channel.type === "twitter"
    ? `${backendUrl}/api/webhooks/twitter`
    : `${backendUrl}/api/webhooks/${channel.type}`;

  const widgetId = channel.webhookVerifyToken;
  const widgetScript = `<script>\n  window.__commscrm = { widgetId: "${widgetId}" };\n</script>\n<script src="${backendUrl}/api/widget.js" async></script>`;

  function copy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    toast({ title: "Copied to clipboard" });
  }

  if (channel.type === "widget") {
    return (
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Card header */}
        <div className={`flex items-center justify-between px-5 py-4 ${meta.lightBg} border-b ${meta.border}`}>
          <div className="flex items-center gap-3">
            <ChannelIcon type="widget" size="md" />
            <div>
              <p className="font-semibold text-sm">{channel.name}</p>
              <p className="text-xs text-muted-foreground">{meta.label}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
            <CheckCircle2 className="h-3 w-3" /> Active
          </span>
        </div>
        {/* Content */}
        <div className="p-5 space-y-4">
          <MaskedField
            label="Widget ID"
            value={widgetId}
            hint="Use this ID to identify your widget in integrations"
            onCopy={() => copy(widgetId)}
          />
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Embed Code</Label>
            <p className="text-xs text-muted-foreground">Paste before &lt;/body&gt; on your website</p>
            <div className="relative">
              <pre className="text-xs font-mono bg-muted/40 rounded-lg p-3 pr-10 text-muted-foreground overflow-x-auto whitespace-pre-wrap border">{widgetScript}</pre>
              <button onClick={() => copy(widgetScript)} className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate()} className="text-destructive hover:text-destructive gap-1.5 h-8">
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-8"
                onClick={() => regenerateMutation.mutate()}
                disabled={regenerateMutation.isPending}
                title="Generate a new Widget ID — update your embed code after regenerating"
              >
                {regenerateMutation.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />}
                Regenerate ID
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => onEdit(channel)}>
                <Settings2 className="h-3.5 w-3.5" /> Customize Widget
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Card header */}
      <div className={`flex items-center justify-between px-5 py-4 ${meta.lightBg} border-b ${meta.border}`}>
        <div className="flex items-center gap-3">
          <ChannelIcon type={channel.type as ChannelKey} size="md" />
          <div>
            <p className="font-semibold text-sm">{channel.name}</p>
            <p className="text-xs text-muted-foreground">{meta.label}</p>
          </div>
        </div>
        {channel.isConnected ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
            <CheckCircle2 className="h-3 w-3" /> Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">
            <XCircle className="h-3 w-3" /> Not connected
          </span>
        )}
      </div>
      {/* Content */}
      <div className="p-5 space-y-4">
        <MaskedField
          label={channel.type === "twitter" ? "Webhook URL (Twitter Developer Portal → App → Webhooks)" : "Webhook URL"}
          value={webhookUrl}
          hint={channel.type === "twitter" ? undefined : "Add this URL in your Meta Developer App webhook settings"}
          onCopy={() => copy(webhookUrl)}
        />
        <MaskedField
          label="Verify Token"
          value={channel.webhookVerifyToken}
          hint="Use this token when setting up your webhook in the developer portal"
          onCopy={() => copy(channel.webhookVerifyToken)}
        />
        <div className="flex items-center justify-between pt-1">
          <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate()} className="text-destructive hover:text-destructive gap-1.5 h-8">
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </Button>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-8"
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending}
              title="Generate a new Verify Token — update your webhook settings after regenerating"
            >
              {regenerateMutation.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" />}
              Regenerate Token
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => onEdit(channel)}>
              <Settings2 className="h-3.5 w-3.5" /> Configure API Keys
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Configure Dialog ──────────────────────────────────────────────────────────
function ConfigureDialog({ channel, onClose }: { channel: ApiChannel; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const meta = CHANNEL_META[channel.type as ChannelKey];
  const [values, setValues] = useState<Record<string, string>>({});
  const [widgetColor, setWidgetColor] = useState<string>((channel.metadata?.color as string) ?? "#7c3aed");
  const [widgetGreeting, setWidgetGreeting] = useState<string>((channel.metadata?.greeting as string) ?? "Hi! How can we help you today?");
  const [widgetPosition, setWidgetPosition] = useState<string>((channel.metadata?.position as string) ?? "bottom-right");
  const [showFields, setShowFields] = useState<Record<string, boolean>>({});

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPut(`/channels/${channel.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channels"] });
      toast({ title: channel.type === "widget" ? "Widget settings saved!" : "Channel updated" });
      onClose();
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const hasExistingCreds = channel.type === "twitter" ? channel.hasTwitterCreds : channel.hasAccessToken || channel.hasPageAccessToken;

  if (channel.type === "widget") {
    return (
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChannelIcon type="widget" size="sm" /> Customize Website Widget
          </DialogTitle>
          <DialogDescription>Adjust the appearance and default message of your chat widget.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Primary Color</Label>
            <p className="text-xs text-muted-foreground mb-1.5">The color of the chat button and header</p>
            <div className="flex items-center gap-3">
              <input type="color" value={widgetColor} onChange={(e) => setWidgetColor(e.target.value)} className="h-9 w-14 rounded-md border cursor-pointer" />
              <Input value={widgetColor} onChange={(e) => setWidgetColor(e.target.value)} className="font-mono text-sm" placeholder="#7c3aed" />
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">Greeting Message</Label>
            <p className="text-xs text-muted-foreground mb-1.5">Shown when a visitor first opens the chat</p>
            <Input value={widgetGreeting} onChange={(e) => setWidgetGreeting(e.target.value)} placeholder="Hi! How can we help you today?" />
          </div>
          <div>
            <Label className="text-sm font-medium">Widget Position</Label>
            <p className="text-xs text-muted-foreground mb-1.5">Corner of the screen where the chat button appears</p>
            <select className="w-full h-9 rounded-md border bg-background px-3 text-sm" value={widgetPosition} onChange={(e) => setWidgetPosition(e.target.value)}>
              <option value="bottom-right">Bottom Right</option>
              <option value="bottom-left">Bottom Left</option>
            </select>
          </div>
          <div className="p-4 rounded-xl border bg-muted/30 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl shadow-lg shrink-0" style={{ backgroundColor: widgetColor }}>
              <MessageSquare className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-muted-foreground mb-0.5">Preview</div>
              <div className="text-sm font-medium truncate">{widgetGreeting}</div>
              <div className="text-xs text-muted-foreground">{widgetPosition === "bottom-right" ? "↘ Bottom right" : "↙ Bottom left"}</div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => updateMutation.mutate({ metadata: { color: widgetColor, greeting: widgetGreeting, position: widgetPosition } })} disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ChannelIcon type={channel.type as ChannelKey} size="sm" /> Configure {meta.label}
        </DialogTitle>
        <DialogDescription>
          Enter your credentials from the{" "}
          <a href={meta.docsUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
            {channel.type === "twitter" ? "Twitter Developer Portal" : "Meta Developer Portal"} <ExternalLink className="h-3 w-3" />
          </a>
        </DialogDescription>
      </DialogHeader>
      <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 py-2.5">
        <AlertCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5" />
        <AlertDescription className="text-xs text-amber-700 dark:text-amber-400">
          Credentials are encrypted at rest. Leave a field blank to keep the existing value.
        </AlertDescription>
      </Alert>
      <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
        {(meta.fields as { key: string; label: string; placeholder: string; type: "text" | "password"; description: string }[]).map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label className="text-sm font-medium">{f.label}</Label>
            <p className="text-xs text-muted-foreground">{f.description}</p>
            <div className="relative">
              <Input
                type={f.type === "password" && !showFields[f.key] ? "password" : "text"}
                placeholder={f.type === "password" && hasExistingCreds ? "••••••• (stored)" : f.placeholder}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className="pr-9"
              />
              {f.type === "password" && (
                <button
                  type="button"
                  onClick={() => setShowFields((s) => ({ ...s, [f.key]: !s[f.key] }))}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showFields[f.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => updateMutation.mutate(values)} disabled={updateMutation.isPending}>
          {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save Configuration
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ── Simulate Dialog ───────────────────────────────────────────────────────────
function SimulateDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ channel: "whatsapp", customerName: "", customerPhone: "", message: "" });
  const [isSending, setIsSending] = useState(false);

  const simulate = async () => {
    if (!form.message) return;
    setIsSending(true);
    try {
      await apiPost("/webhooks/simulate", form);
      qc.invalidateQueries({ queryKey: ["conversations"] });
      toast({ title: "Message simulated!", description: "Check your Inbox for the new conversation." });
      onClose();
    } catch {
      toast({ title: "Simulation failed", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-500" /> Simulate Incoming Message
        </DialogTitle>
        <DialogDescription>Test your inbox by simulating a customer message from any channel.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>Channel</Label>
          <select className="w-full mt-1.5 h-9 rounded-md border bg-background px-3 text-sm" value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}>
            <option value="whatsapp">WhatsApp</option>
            <option value="facebook">Facebook Messenger</option>
            <option value="instagram">Instagram Direct</option>
            <option value="twitter">Twitter / X</option>
            <option value="widget">Website Widget</option>
          </select>
        </div>
        <div>
          <Label>Customer Name</Label>
          <Input placeholder="John Doe" value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} className="mt-1.5" />
        </div>
        <div>
          <Label>Customer ID / Handle</Label>
          <Input placeholder="+1234567890 or @handle" value={form.customerPhone} onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))} className="mt-1.5" />
        </div>
        <div>
          <Label>Message</Label>
          <textarea
            placeholder="Hello, I need help with my order…"
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            className="w-full mt-1.5 rounded-md border bg-background px-3 py-2 text-sm resize-none h-20 outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={simulate} disabled={!form.message || isSending} className="gap-2">
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Send Test Message
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ── Empty state for a channel type ────────────────────────────────────────────
const REQUIREMENTS: Record<ChannelKey, React.ReactNode> = {
  whatsapp:  (<><li>A Meta Business account</li><li>WhatsApp Business API access</li><li>A verified WhatsApp phone number</li></>),
  facebook:  (<><li>A Facebook Business Page</li><li>A Meta Developer App</li><li>Messenger API permissions</li></>),
  instagram: (<><li>An Instagram Business account linked to a Facebook Page</li><li>A Meta Developer App with Instagram Basic Display API</li><li>Instagram messaging permissions approved</li></>),
  twitter:   (<><li>A Twitter Developer account and app</li><li>Elevated access (or API v2 access for DMs)</li><li>Direct Message read/write permissions</li></>),
  widget:    (<><li>Access to your website's HTML</li><li>No third-party accounts or API keys needed</li><li>Works on any website — WordPress, Webflow, Shopify, etc.</li></>),
  email:     (<><li>SMTP credentials from your email provider</li><li>IMAP credentials to receive emails</li><li>An app password if using Gmail/Outlook</li></>),
};

// ── Email panel ───────────────────────────────────────────────────────────────
function EmailPanel({ onSaved }: { onSaved: () => void }) {
  const { toast } = useToast();
  const [cfg, setCfg] = useState({ smtpHost: "", smtpPort: "587", smtpUser: "", smtpPassword: "", imapHost: "", imapPort: "993", fromName: "", fromEmail: "", useSSL: true });
  const [showPwd, setShowPwd] = useState(false);
  const [saved, setSaved] = useState(false);

  function save() {
    if (!cfg.smtpHost || !cfg.fromEmail) {
      toast({ title: "SMTP host and From Email are required", variant: "destructive" });
      return;
    }
    setSaved(true);
    onSaved();
    toast({ title: "Email settings saved", description: "Your email account has been connected to CommsCRM." });
  }

  return (
    <div className="space-y-6">
      {saved && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20 py-3">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700 dark:text-green-400 text-sm">Email configured! CommsCRM will deliver emails to your inbox.</AlertDescription>
        </Alert>
      )}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 bg-indigo-50 dark:bg-indigo-950/20 border-b border-indigo-200 dark:border-indigo-900">
          <ChannelIcon type="email" size="md" />
          <div>
            <p className="font-semibold text-sm">Email (SMTP / IMAP)</p>
            <p className="text-xs text-muted-foreground">Receive and reply to customer emails via your unified inbox</p>
          </div>
        </div>
        <div className="p-5 space-y-6">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold mb-0.5">Sender Identity</p>
              <p className="text-xs text-muted-foreground mb-3">The name and email address customers will see</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Display Name</Label>
                <Input placeholder="Support Team" value={cfg.fromName} onChange={(e) => setCfg((p) => ({ ...p, fromName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide font-medium">From Email</Label>
                <Input placeholder="support@yourcompany.com" type="email" value={cfg.fromEmail} onChange={(e) => setCfg((p) => ({ ...p, fromEmail: e.target.value }))} />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold mb-0.5">Outgoing Mail (SMTP)</p>
              <p className="text-xs text-muted-foreground mb-3">Used to send replies to customers</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide font-medium">SMTP Host</Label>
                <Input placeholder="smtp.gmail.com" value={cfg.smtpHost} onChange={(e) => setCfg((p) => ({ ...p, smtpHost: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Port</Label>
                <Input placeholder="587" value={cfg.smtpPort} onChange={(e) => setCfg((p) => ({ ...p, smtpPort: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Username / Email</Label>
                <Input placeholder="you@gmail.com" value={cfg.smtpUser} onChange={(e) => setCfg((p) => ({ ...p, smtpUser: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide font-medium">App Password</Label>
                <div className="relative">
                  <Input type={showPwd ? "text" : "password"} placeholder="Enter app password…" value={cfg.smtpPassword} onChange={(e) => setCfg((p) => ({ ...p, smtpPassword: e.target.value }))} className="pr-9" />
                  <button onClick={() => setShowPwd((v) => !v)} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold mb-0.5">Incoming Mail (IMAP)</p>
              <p className="text-xs text-muted-foreground mb-3">Used to receive and sync customer emails into your inbox</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide font-medium">IMAP Host</Label>
                <Input placeholder="imap.gmail.com" value={cfg.imapHost} onChange={(e) => setCfg((p) => ({ ...p, imapHost: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Port</Label>
                <Input placeholder="993" value={cfg.imapPort} onChange={(e) => setCfg((p) => ({ ...p, imapPort: e.target.value }))} />
              </div>
            </div>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900 text-sm space-y-2">
            <p className="font-medium flex items-center gap-2 text-blue-800 dark:text-blue-300"><AlertCircle className="h-4 w-4" /> Gmail recommended setup</p>
            <ul className="list-disc pl-5 space-y-1 text-blue-700 dark:text-blue-400 text-xs">
              <li>Enable 2-factor authentication on your Google account</li>
              <li>Generate an App Password under Google Account → Security</li>
              <li>SMTP: smtp.gmail.com:587 (TLS) · IMAP: imap.gmail.com:993 (SSL)</li>
            </ul>
            <a href="https://support.google.com/mail/answer/7126229" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 text-xs font-medium">
              Gmail IMAP setup guide <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={() => { setCfg({ smtpHost: "", smtpPort: "587", smtpUser: "", smtpPassword: "", imapHost: "", imapPort: "993", fromName: "", fromEmail: "", useSSL: true }); setSaved(false); }}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Reset
            </Button>
            <Button onClick={save} className="gap-2">
              <Save className="h-4 w-4" /> Save Email Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const ALL_TABS: ChannelKey[] = ["whatsapp", "facebook", "instagram", "twitter", "widget", "email"];

export default function Channels() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<ChannelKey>("whatsapp");
  const [configuringChannel, setConfiguringChannel] = useState<ApiChannel | null>(null);
  const [showSimulate, setShowSimulate] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);

  const { data: channels = [], isLoading } = useQuery<ApiChannel[]>({
    queryKey: ["channels"],
    queryFn: () => apiGet("/channels"),
  });

  const createMutation = useMutation({
    mutationFn: ({ type }: { type: ChannelType }) => apiPost("/channels", { type, name: CHANNEL_META[type].label }),
    onSuccess: (_, { type }) => {
      qc.invalidateQueries({ queryKey: ["channels"] });
      toast({
        title: type === "widget" ? "Website Widget created!" : "Channel added",
        description: type === "widget" ? "Copy the embed code and paste it on your website." : "Now configure your API credentials.",
      });
    },
    onError: (err: { message?: string }) => {
      toast({ title: err?.message?.includes("already exists") ? "Channel already added" : "Failed to add channel", variant: "destructive" });
    },
  });

  const existing = channels.find((c) => c.type === activeTab);
  const meta = CHANNEL_META[activeTab];
  const isConnected = existing?.isConnected ?? false;
  const isActive = activeTab === "widget" ? !!existing : isConnected;

  return (
    <div className="h-full flex overflow-hidden">
      {/* ── Left sidebar ── */}
      <aside className="w-64 border-r bg-muted/20 flex flex-col shrink-0 overflow-y-auto">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-sm">Channel Connections</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Connect your messaging channels</p>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {ALL_TABS.map((type) => {
            const m = CHANNEL_META[type];
            const ch = channels.find((c) => c.type === type);
            const connected = type === "widget" ? !!ch : (ch?.isConnected ?? false);
            const isEmail = type === "email";
            const emailConnected = isEmail && emailSaved;
            const showDot = connected || emailConnected;
            return (
              <button
                key={type}
                onClick={() => setActiveTab(type)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left ${
                  activeTab === type
                    ? "bg-background shadow-sm border text-foreground font-medium"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                }`}
              >
                <ChannelIcon type={type} size="sm" />
                <span className="flex-1">{m.shortLabel}</span>
                {showDot && (
                  <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                )}
                {activeTab === type && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t">
          <Button size="sm" variant="outline" className="w-full gap-2 h-8" onClick={() => setShowSimulate(true)}>
            <Zap className="h-3.5 w-3.5 text-yellow-500" /> Simulate Message
          </Button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-6 space-y-6">
          {/* Page header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <ChannelIcon type={activeTab} size="lg" />
              <div>
                <h1 className="text-xl font-bold tracking-tight">{meta.label}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{meta.description}</p>
              </div>
            </div>
            {activeTab !== "email" && (
              <div className="shrink-0">
                {isActive ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" /> Active
                  </span>
                ) : existing ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Credentials pending
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" /> Not connected
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Email tab */}
          {activeTab === "email" && <EmailPanel onSaved={() => setEmailSaved(true)} />}

          {/* Other channel tabs */}
          {activeTab !== "email" && (
            isLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : existing ? (
              <ChannelCard channel={existing} onEdit={setConfiguringChannel} />
            ) : (
              /* Empty state */
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className={`h-1.5 w-full ${meta.bgClass}`} />
                <div className="p-8 text-center space-y-6">
                  <div className="flex justify-center">
                    <ChannelIcon type={activeTab} size="lg" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base mb-1">Connect {meta.label}</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      {activeTab === "widget"
                        ? "Add a live chat bubble to your website in minutes. Visitors can chat with your team directly from any page."
                        : `Connect your ${meta.label} account to start receiving and sending messages through CommsCRM.`}
                    </p>
                  </div>
                  <div className="p-4 bg-muted/40 rounded-xl text-left text-sm space-y-2 max-w-sm mx-auto">
                    <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Before you start</p>
                    <ul className="space-y-1.5 text-muted-foreground text-sm">
                      {REQUIREMENTS[activeTab]}
                    </ul>
                    {activeTab !== "widget" && (
                      <a href={meta.docsUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-xs mt-1 font-medium">
                        View setup guide <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <Button onClick={() => createMutation.mutate({ type: activeTab as ChannelType })} disabled={createMutation.isPending} className="gap-2" size="lg">
                    {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {activeTab === "widget" ? "Create Website Widget" : `Add ${meta.shortLabel}`}
                  </Button>
                </div>
              </div>
            )
          )}

          {/* API docs link */}
          {activeTab !== "email" && meta.docsUrl && (
            <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/20 text-sm">
              <div className="flex items-center gap-3">
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Need help setting this up?</span>
              </div>
              <a href={meta.docsUrl} target="_blank" rel="noreferrer" className="text-primary font-medium hover:underline inline-flex items-center gap-1 text-xs">
                Open documentation <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={!!configuringChannel} onOpenChange={(o) => !o && setConfiguringChannel(null)}>
        {configuringChannel && <ConfigureDialog channel={configuringChannel} onClose={() => setConfiguringChannel(null)} />}
      </Dialog>
      <Dialog open={showSimulate} onOpenChange={setShowSimulate}>
        {showSimulate && <SimulateDialog onClose={() => setShowSimulate(false)} />}
      </Dialog>
    </div>
  );
}
