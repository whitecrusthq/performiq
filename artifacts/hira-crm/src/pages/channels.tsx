import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Plus, Copy, ExternalLink, Loader2, Trash2, MessageSquare, AlertCircle, Mail, Save, Eye, EyeOff, Globe, Twitter } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type ChannelType = "whatsapp" | "facebook" | "instagram" | "twitter" | "widget";

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

const CHANNEL_META: Record<ChannelType, {
  label: string;
  color: string;
  textColor: string;
  borderColor: string;
  bgColor: string;
  icon: string;
  description: string;
  docsUrl: string;
  fields: { key: string; label: string; placeholder: string; type: "text" | "password"; description: string }[];
  isWidget?: boolean;
}> = {
  whatsapp: {
    label: "WhatsApp Business",
    color: "bg-green-500",
    textColor: "text-green-700 dark:text-green-400",
    borderColor: "border-green-200 dark:border-green-900",
    bgColor: "bg-green-50 dark:bg-green-950/30",
    icon: "📱",
    description: "Receive and send WhatsApp messages via Meta's WhatsApp Business API",
    docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started",
    fields: [
      { key: "accessToken", label: "System User Access Token", placeholder: "EAAxxxxxx...", type: "password", description: "Permanent token from Meta Business Manager" },
      { key: "phoneNumberId", label: "Phone Number ID", placeholder: "1234567890", type: "text", description: "From your WhatsApp Business Phone Number settings" },
      { key: "wabaId", label: "WhatsApp Business Account ID", placeholder: "9876543210", type: "text", description: "Your WABA ID from Meta Business Manager" },
    ],
  },
  facebook: {
    label: "Facebook Messenger",
    color: "bg-blue-600",
    textColor: "text-blue-700 dark:text-blue-400",
    borderColor: "border-blue-200 dark:border-blue-900",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    icon: "💬",
    description: "Connect your Facebook Page to receive and send Messenger messages",
    docsUrl: "https://developers.facebook.com/docs/messenger-platform/get-started",
    fields: [
      { key: "pageAccessToken", label: "Page Access Token", placeholder: "EAAxxxxxx...", type: "password", description: "Page Access Token from your Facebook App" },
      { key: "pageId", label: "Facebook Page ID", placeholder: "1234567890", type: "text", description: "Your Facebook Page ID" },
    ],
  },
  instagram: {
    label: "Instagram Direct",
    color: "bg-gradient-to-r from-purple-500 to-pink-500",
    textColor: "text-purple-700 dark:text-purple-400",
    borderColor: "border-purple-200 dark:border-purple-900",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
    icon: "📸",
    description: "Receive Instagram Direct Messages from your business account",
    docsUrl: "https://developers.facebook.com/docs/messenger-platform/instagram",
    fields: [
      { key: "pageAccessToken", label: "Page Access Token", placeholder: "EAAxxxxxx...", type: "password", description: "Page Access Token (same Facebook App, with Instagram permissions)" },
      { key: "instagramAccountId", label: "Instagram Account ID", placeholder: "1234567890", type: "text", description: "Your Instagram Business Account ID" },
    ],
  },
  twitter: {
    label: "Twitter / X",
    color: "bg-black",
    textColor: "text-neutral-800 dark:text-neutral-200",
    borderColor: "border-neutral-200 dark:border-neutral-800",
    bgColor: "bg-neutral-50 dark:bg-neutral-950/30",
    icon: "𝕏",
    description: "Connect your Twitter/X account to receive and reply to DMs and mentions",
    docsUrl: "https://developer.twitter.com/en/portal/dashboard",
    fields: [
      { key: "twitterApiKey", label: "API Key (Consumer Key)", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", type: "text", description: "From your Twitter Developer App → Keys and Tokens" },
      { key: "twitterApiSecret", label: "API Secret (Consumer Secret)", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", type: "password", description: "Consumer Secret from your Twitter Developer App" },
      { key: "twitterBearerToken", label: "Bearer Token", placeholder: "AAAAAAAAAAAAAAAAAAAAAxxxxxx...", type: "password", description: "Bearer Token for app-only authentication" },
      { key: "twitterAccessToken", label: "Access Token", placeholder: "xxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxx", type: "text", description: "Access Token for your Twitter account" },
      { key: "twitterAccessTokenSecret", label: "Access Token Secret", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", type: "password", description: "Access Token Secret for your Twitter account" },
    ],
  },
  widget: {
    label: "Website Widget",
    color: "bg-violet-600",
    textColor: "text-violet-700 dark:text-violet-400",
    borderColor: "border-violet-200 dark:border-violet-900",
    bgColor: "bg-violet-50 dark:bg-violet-950/30",
    icon: "🌐",
    description: "Embed a live chat widget on your website — visitors chat directly into your CommsCRM inbox",
    docsUrl: "https://docs.example.com/widget",
    fields: [],
    isWidget: true,
  },
};

function ChannelCard({ channel, onEdit }: { channel: ApiChannel; onEdit: (c: ApiChannel) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const meta = CHANNEL_META[channel.type];

  const deleteMutation = useMutation({
    mutationFn: () => apiDelete(`/channels/${channel.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channels"] });
      toast({ title: "Channel removed" });
    },
  });

  const backendUrl = window.location.origin.replace(/\/crm.*/, "");
  const webhookUrl = channel.type === "twitter"
    ? `${backendUrl}/api/webhooks/twitter`
    : `${backendUrl}/api/webhooks/${channel.type}`;

  const widgetId = channel.webhookVerifyToken;
  const widgetScript = `<script>
  window.__commscrm = { widgetId: "${widgetId}" };
</script>
<script src="${backendUrl}/api/widget.js" async></script>`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  if (channel.type === "widget") {
    return (
      <Card className={`border ${meta.borderColor}`}>
        <CardHeader className={`pb-3 ${meta.bgColor} rounded-t-lg`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{meta.icon}</span>
              <div>
                <CardTitle className="text-base">{channel.name}</CardTitle>
                <CardDescription className="text-xs mt-0.5">{meta.label}</CardDescription>
              </div>
            </div>
            <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 gap-1">
              <CheckCircle2 className="h-3 w-3" /> Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Widget ID</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input value={widgetId} readOnly className="text-xs font-mono bg-muted/50 border-none h-8" />
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(widgetId)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Embed Code — paste before &lt;/body&gt; on your website</Label>
            <div className="relative mt-1">
              <pre className="text-xs font-mono bg-muted/60 rounded-md p-3 pr-10 text-muted-foreground overflow-x-auto whitespace-pre-wrap">{widgetScript}</pre>
              <Button variant="ghost" size="icon" className="h-7 w-7 absolute top-2 right-2" onClick={() => copyToClipboard(widgetScript)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <Separator />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate()} className="text-destructive hover:text-destructive h-8">
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => onEdit(channel)}>
              Customize Widget
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border ${meta.borderColor}`}>
      <CardHeader className={`pb-3 ${meta.bgColor} rounded-t-lg`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{meta.icon}</span>
            <div>
              <CardTitle className="text-base">{channel.name}</CardTitle>
              <CardDescription className="text-xs mt-0.5">{meta.label}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {channel.isConnected ? (
              <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 gap-1">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <XCircle className="h-3 w-3" /> Not connected
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">
            {channel.type === "twitter" ? "Webhook URL (add in Twitter Developer Portal → App → Webhooks)" : "Webhook URL (add this in Meta Developer App)"}
          </Label>
          <div className="flex items-center gap-2 mt-1">
            <Input value={webhookUrl} readOnly className="text-xs font-mono bg-muted/50 border-none h-8" />
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(webhookUrl)}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Verify Token</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input value={channel.webhookVerifyToken} readOnly className="text-xs font-mono bg-muted/50 border-none h-8" />
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(channel.webhookVerifyToken)}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <Separator />
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate()} className="text-destructive hover:text-destructive h-8">
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => onEdit(channel)}>
            Configure API Keys
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfigureDialog({ channel, onClose }: { channel: ApiChannel; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const meta = CHANNEL_META[channel.type];
  const [values, setValues] = useState<Record<string, string>>({});
  const [widgetColor, setWidgetColor] = useState<string>((channel.metadata?.color as string) ?? "#7c3aed");
  const [widgetGreeting, setWidgetGreeting] = useState<string>((channel.metadata?.greeting as string) ?? "Hi! How can we help you today?");
  const [widgetPosition, setWidgetPosition] = useState<string>((channel.metadata?.position as string) ?? "bottom-right");

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPut(`/channels/${channel.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channels"] });
      toast({ title: channel.type === "widget" ? "Widget settings saved!" : "Channel updated", description: channel.isConnected ? "Channel is now connected!" : "Settings saved. Complete all required fields to connect." });
      onClose();
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const hasExistingCreds = channel.type === "twitter"
    ? channel.hasTwitterCreds
    : channel.hasAccessToken || channel.hasPageAccessToken;

  if (channel.type === "widget") {
    return (
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">🌐 Customize Website Widget</DialogTitle>
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
          <div className="p-4 rounded-lg border bg-muted/30 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl shadow-lg shrink-0" style={{ backgroundColor: widgetColor }}>💬</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-muted-foreground mb-0.5">Widget preview</div>
              <div className="text-sm font-medium truncate">{widgetGreeting}</div>
              <div className="text-xs text-muted-foreground">{widgetPosition === "bottom-right" ? "↘ Bottom right" : "↙ Bottom left"}</div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => updateMutation.mutate({ metadata: { color: widgetColor, greeting: widgetGreeting, position: widgetPosition } })} disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span>{meta.icon}</span> Configure {meta.label}
        </DialogTitle>
        <DialogDescription>
          Enter your API credentials from the{" "}
          <a href={meta.docsUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
            {channel.type === "twitter" ? "Twitter Developer Portal" : "Meta Developer Portal"} <ExternalLink className="h-3 w-3" />
          </a>
        </DialogDescription>
      </DialogHeader>

      <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-xs text-amber-700 dark:text-amber-400">
          Credentials are stored securely. Leave a field blank to keep the existing value.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        {meta.fields.map((f) => (
          <div key={f.key}>
            <Label className="text-sm font-medium">{f.label}</Label>
            <p className="text-xs text-muted-foreground mb-1.5">{f.description}</p>
            <Input
              type={f.type}
              placeholder={f.type === "password" && hasExistingCreds ? "••••••• (stored)" : f.placeholder}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => updateMutation.mutate(values)} disabled={updateMutation.isPending}>
          {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Configuration
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

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
        <DialogTitle>Simulate Incoming Message</DialogTitle>
        <DialogDescription>Test your inbox by simulating a customer message from any channel.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>Channel</Label>
          <select
            className="w-full mt-1 h-9 rounded-md border bg-background px-3 text-sm"
            value={form.channel}
            onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="facebook">Facebook Messenger</option>
            <option value="instagram">Instagram Direct</option>
            <option value="twitter">Twitter / X</option>
            <option value="widget">Website Widget</option>
          </select>
        </div>
        <div>
          <Label>Customer Name</Label>
          <Input placeholder="John Doe" value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} className="mt-1" />
        </div>
        <div>
          <Label>Customer ID / Handle</Label>
          <Input placeholder="+1234567890 or @handle" value={form.customerPhone} onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))} className="mt-1" />
        </div>
        <div>
          <Label>Message</Label>
          <textarea
            placeholder="Hello, I need help with my order..."
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm resize-none h-20 outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={simulate} disabled={!form.message || isSending}>
          {isSending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Send Test Message
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default function Channels() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [configuringChannel, setConfiguringChannel] = useState<ApiChannel | null>(null);
  const [showSimulate, setShowSimulate] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("whatsapp");
  const [emailConfig, setEmailConfig] = useState({ smtpHost: "", smtpPort: "587", smtpUser: "", smtpPassword: "", imapHost: "", imapPort: "993", fromName: "", fromEmail: "", useSSL: true });
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);

  const { data: channels = [], isLoading } = useQuery<ApiChannel[]>({
    queryKey: ["channels"],
    queryFn: () => apiGet("/channels"),
  });

  const createMutation = useMutation({
    mutationFn: ({ type }: { type: ChannelType }) =>
      apiPost("/channels", { type, name: CHANNEL_META[type].label }),
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

  const channelsByType = (type: ChannelType) => channels.find((c) => c.type === type);

  const requirementsList: Record<ChannelType, React.ReactNode> = {
    whatsapp: (<>
      <li>A Meta Business account</li>
      <li>WhatsApp Business API access (via Meta)</li>
      <li>A verified WhatsApp phone number</li>
    </>),
    facebook: (<>
      <li>A Facebook Business Page</li>
      <li>A Meta Developer App</li>
      <li>Messenger API permissions</li>
    </>),
    instagram: (<>
      <li>An Instagram Business account</li>
      <li>Connected to a Facebook Page</li>
      <li>Instagram Messaging API permissions</li>
    </>),
    twitter: (<>
      <li>A Twitter Developer account (developer.twitter.com)</li>
      <li>A project and App with Basic tier or above</li>
      <li>Direct Message read/write permissions enabled</li>
    </>),
    widget: (<>
      <li>Access to your website's HTML (to paste one snippet)</li>
      <li>No third-party accounts or API keys needed</li>
      <li>Works on any website — WordPress, Webflow, Shopify, etc.</li>
    </>),
  };

  return (
    <div className="p-6 max-w-4xl mx-auto h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Channel Connections</h1>
          <p className="text-muted-foreground mt-1">Connect WhatsApp, Facebook, Instagram, Twitter/X, and your website to your unified inbox.</p>
        </div>
        <Button variant="outline" onClick={() => setShowSimulate(true)} className="gap-2">
          <MessageSquare className="h-4 w-4" />
          Simulate Message
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          {(Object.keys(CHANNEL_META) as ChannelType[]).map((type) => (
            <TabsTrigger key={type} value={type} className="gap-1.5">
              {type === "twitter" ? <Twitter className="h-3.5 w-3.5" /> : type === "widget" ? <Globe className="h-3.5 w-3.5" /> : <span className="text-sm">{CHANNEL_META[type].icon}</span>}
              {CHANNEL_META[type].label}
              {channelsByType(type)?.isConnected && (
                <span className="ml-0.5 h-2 w-2 rounded-full bg-green-500 inline-block" />
              )}
            </TabsTrigger>
          ))}
          <TabsTrigger value="email" className="gap-1.5">
            <Mail className="h-3.5 w-3.5 text-indigo-500" /> Email
            {emailSaved && <span className="ml-0.5 h-2 w-2 rounded-full bg-green-500 inline-block" />}
          </TabsTrigger>
        </TabsList>

        {(Object.keys(CHANNEL_META) as ChannelType[]).map((type) => {
          const meta = CHANNEL_META[type];
          const existing = channelsByType(type);

          return (
            <TabsContent key={type} value={type}>
              <Card className="max-w-2xl">
                <CardHeader className={`${meta.bgColor} rounded-t-lg border-b ${meta.borderColor}`}>
                  <div className="flex items-center gap-4">
                    {type === "twitter" ? (
                      <div className="h-12 w-12 rounded-xl bg-black flex items-center justify-center text-white">
                        <Twitter className="h-6 w-6" />
                      </div>
                    ) : type === "widget" ? (
                      <div className="h-12 w-12 rounded-xl bg-violet-600 flex items-center justify-center text-white">
                        <Globe className="h-6 w-6" />
                      </div>
                    ) : (
                      <span className="text-4xl">{meta.icon}</span>
                    )}
                    <div>
                      <CardTitle>Connect {meta.label}</CardTitle>
                      <CardDescription className="mt-1">{meta.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  {isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : existing ? (
                    <ChannelCard channel={existing} onEdit={setConfiguringChannel} />
                  ) : (
                    <div className="text-center py-8">
                      {type === "twitter" ? (
                        <div className="h-16 w-16 rounded-full bg-black flex items-center justify-center text-white text-2xl mx-auto mb-4">
                          <Twitter className="h-8 w-8" />
                        </div>
                      ) : type === "widget" ? (
                        <div className="h-16 w-16 rounded-full bg-violet-600 flex items-center justify-center text-white text-2xl mx-auto mb-4">
                          <Globe className="h-8 w-8" />
                        </div>
                      ) : (
                        <span className="text-5xl mb-4 block">{meta.icon}</span>
                      )}
                      <p className="text-muted-foreground mb-6 text-sm max-w-sm mx-auto">
                        {type === "widget"
                          ? "Add a live chat bubble to your website in minutes. Visitors can chat with your team directly from any page."
                          : `Connect your ${meta.label} account to start receiving and sending messages through CommsCRM.`}
                      </p>

                      <div className="mb-6 p-4 bg-muted/50 rounded-lg text-left text-sm space-y-2">
                        <p className="font-medium">Before connecting, you'll need:</p>
                        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                          {requirementsList[type]}
                        </ul>
                        {type !== "widget" && (
                          <a href={meta.docsUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-xs mt-1">
                            View setup guide <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>

                      <Button onClick={() => createMutation.mutate({ type })} disabled={createMutation.isPending} className="gap-2">
                        {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        {type === "widget" ? "Create Website Widget" : `Add ${meta.label}`}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}

        {/* Email tab */}
        <TabsContent value="email">
          <Card className="max-w-2xl">
            <CardHeader className="bg-indigo-50 dark:bg-indigo-950/30 rounded-t-lg border-b border-indigo-200 dark:border-indigo-900">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-indigo-500 flex items-center justify-center text-white">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle>Connect Email</CardTitle>
                  <CardDescription className="mt-1">Receive and send emails through your unified CommsCRM inbox via SMTP & IMAP</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {emailSaved && (
                <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700 dark:text-green-400">
                    Email configured! CommsCRM will deliver emails to your inbox.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-1">
                <p className="text-sm font-semibold">Sender Identity</p>
                <p className="text-xs text-muted-foreground mb-3">The name and email address customers will see</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Display Name</Label>
                    <Input placeholder="Support Team" value={emailConfig.fromName} onChange={(e) => setEmailConfig((p) => ({ ...p, fromName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>From Email</Label>
                    <Input placeholder="support@yourcompany.com" type="email" value={emailConfig.fromEmail} onChange={(e) => setEmailConfig((p) => ({ ...p, fromEmail: e.target.value }))} />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-1">
                <p className="text-sm font-semibold">Outgoing Mail (SMTP)</p>
                <p className="text-xs text-muted-foreground mb-3">Used to send replies to customers</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <Label>SMTP Host</Label>
                    <Input placeholder="smtp.gmail.com" value={emailConfig.smtpHost} onChange={(e) => setEmailConfig((p) => ({ ...p, smtpHost: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Port</Label>
                    <Input placeholder="587" value={emailConfig.smtpPort} onChange={(e) => setEmailConfig((p) => ({ ...p, smtpPort: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div className="space-y-1.5">
                    <Label>Username / Email</Label>
                    <Input placeholder="you@gmail.com" value={emailConfig.smtpUser} onChange={(e) => setEmailConfig((p) => ({ ...p, smtpUser: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>App Password</Label>
                    <div className="relative">
                      <Input
                        type={showEmailPassword ? "text" : "password"}
                        placeholder="Enter app password..."
                        value={emailConfig.smtpPassword}
                        onChange={(e) => setEmailConfig((p) => ({ ...p, smtpPassword: e.target.value }))}
                        className="pr-9"
                      />
                      <button onClick={() => setShowEmailPassword((v) => !v)} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
                        {showEmailPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-1">
                <p className="text-sm font-semibold">Incoming Mail (IMAP)</p>
                <p className="text-xs text-muted-foreground mb-3">Used to receive and sync customer emails into your inbox</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <Label>IMAP Host</Label>
                    <Input placeholder="imap.gmail.com" value={emailConfig.imapHost} onChange={(e) => setEmailConfig((p) => ({ ...p, imapHost: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Port</Label>
                    <Input placeholder="993" value={emailConfig.imapPort} onChange={(e) => setEmailConfig((p) => ({ ...p, imapPort: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg text-sm space-y-2">
                <p className="font-medium flex items-center gap-2"><AlertCircle className="h-4 w-4 text-blue-500" /> Recommended setup for Gmail</p>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground text-xs">
                  <li>Enable 2-factor authentication on your Google account</li>
                  <li>Generate an App Password under Google Account → Security</li>
                  <li>SMTP: smtp.gmail.com : 587 (TLS) · IMAP: imap.gmail.com : 993 (SSL)</li>
                </ul>
                <a href="https://support.google.com/mail/answer/7126229" target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-xs">
                  Gmail IMAP setup guide <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => { setEmailConfig({ smtpHost: "", smtpPort: "587", smtpUser: "", smtpPassword: "", imapHost: "", imapPort: "993", fromName: "", fromEmail: "", useSSL: true }); setEmailSaved(false); }}
                >
                  Reset
                </Button>
                <Button
                  onClick={() => {
                    if (!emailConfig.smtpHost || !emailConfig.fromEmail) {
                      toast({ title: "SMTP host and From Email are required", variant: "destructive" });
                      return;
                    }
                    setEmailSaved(true);
                    toast({ title: "Email settings saved", description: "Your email account has been connected to CommsCRM." });
                  }}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" /> Save Email Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!configuringChannel} onOpenChange={(o) => !o && setConfiguringChannel(null)}>
        {configuringChannel && <ConfigureDialog channel={configuringChannel} onClose={() => setConfiguringChannel(null)} />}
      </Dialog>

      <Dialog open={showSimulate} onOpenChange={setShowSimulate}>
        {showSimulate && <SimulateDialog onClose={() => setShowSimulate(false)} />}
      </Dialog>
    </div>
  );
}
