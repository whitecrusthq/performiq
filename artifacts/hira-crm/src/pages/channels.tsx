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
import { CheckCircle2, XCircle, Plus, Copy, ExternalLink, Loader2, Trash2, MessageSquare, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type ChannelType = "whatsapp" | "facebook" | "instagram";

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
  hasAccessToken: boolean;
  hasPageAccessToken: boolean;
}

const CHANNEL_META = {
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
      { key: "accessToken", label: "System User Access Token", placeholder: "EAAxxxxxx...", type: "password" as const, description: "Permanent token from Meta Business Manager" },
      { key: "phoneNumberId", label: "Phone Number ID", placeholder: "1234567890", type: "text" as const, description: "From your WhatsApp Business Phone Number settings" },
      { key: "wabaId", label: "WhatsApp Business Account ID", placeholder: "9876543210", type: "text" as const, description: "Your WABA ID from Meta Business Manager" },
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
      { key: "pageAccessToken", label: "Page Access Token", placeholder: "EAAxxxxxx...", type: "password" as const, description: "Page Access Token from your Facebook App" },
      { key: "pageId", label: "Facebook Page ID", placeholder: "1234567890", type: "text" as const, description: "Your Facebook Page ID" },
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
      { key: "pageAccessToken", label: "Page Access Token", placeholder: "EAAxxxxxx...", type: "password" as const, description: "Page Access Token (same Facebook App, with Instagram permissions)" },
      { key: "instagramAccountId", label: "Instagram Account ID", placeholder: "1234567890", type: "text" as const, description: "Your Instagram Business Account ID" },
    ],
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
  const webhookUrl = `${backendUrl}/api/webhooks/${channel.type}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

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
          <Label className="text-xs text-muted-foreground">Webhook URL (add this in Meta Developer App)</Label>
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

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, string>) => apiPut(`/channels/${channel.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channels"] });
      toast({ title: "Channel updated", description: channel.isConnected ? "Channel is now connected!" : "Settings saved. Complete all required fields to connect." });
      onClose();
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span>{meta.icon}</span> Configure {meta.label}
        </DialogTitle>
        <DialogDescription>
          Enter your API credentials from the{" "}
          <a href={meta.docsUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
            Meta Developer Portal <ExternalLink className="h-3 w-3" />
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
              placeholder={f.type === "password" && (channel.hasAccessToken || channel.hasPageAccessToken) ? "••••••• (stored)" : f.placeholder}
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
          </select>
        </div>
        <div>
          <Label>Customer Name</Label>
          <Input placeholder="John Doe" value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} className="mt-1" />
        </div>
        <div>
          <Label>Customer Phone / ID</Label>
          <Input placeholder="+1234567890" value={form.customerPhone} onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))} className="mt-1" />
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
  const [activeTab, setActiveTab] = useState<ChannelType>("whatsapp");

  const { data: channels = [], isLoading } = useQuery<ApiChannel[]>({
    queryKey: ["channels"],
    queryFn: () => apiGet("/channels"),
  });

  const createMutation = useMutation({
    mutationFn: ({ type }: { type: ChannelType }) =>
      apiPost("/channels", { type, name: CHANNEL_META[type].label }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channels"] });
      toast({ title: "Channel added", description: "Now configure your API credentials." });
    },
    onError: (err: { message?: string }) => {
      toast({ title: err?.message?.includes("already exists") ? "Channel already added" : "Failed to add channel", variant: "destructive" });
    },
  });

  const channelsByType = (type: ChannelType) => channels.find((c) => c.type === type);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Channel Connections</h1>
          <p className="text-muted-foreground mt-1">Connect WhatsApp, Facebook, and Instagram to your unified inbox.</p>
        </div>
        <Button variant="outline" onClick={() => setShowSimulate(true)} className="gap-2">
          <MessageSquare className="h-4 w-4" />
          Simulate Message
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ChannelType)}>
        <TabsList className="mb-6">
          {(Object.keys(CHANNEL_META) as ChannelType[]).map((type) => (
            <TabsTrigger key={type} value={type} className="gap-2">
              {CHANNEL_META[type].icon} {CHANNEL_META[type].label}
              {channelsByType(type)?.isConnected && (
                <span className="ml-1 h-2 w-2 rounded-full bg-green-500 inline-block" />
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {(Object.keys(CHANNEL_META) as ChannelType[]).map((type) => {
          const meta = CHANNEL_META[type];
          const existing = channelsByType(type);

          return (
            <TabsContent key={type} value={type}>
              <Card className="max-w-2xl">
                <CardHeader className={`${meta.bgColor} rounded-t-lg border-b ${meta.borderColor}`}>
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">{meta.icon}</span>
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
                      <span className="text-5xl mb-4 block">{meta.icon}</span>
                      <p className="text-muted-foreground mb-6 text-sm max-w-sm mx-auto">
                        Connect your {meta.label} account to start receiving and sending messages through HiraCRM.
                      </p>

                      <div className="mb-6 p-4 bg-muted/50 rounded-lg text-left text-sm space-y-2">
                        <p className="font-medium">Before connecting, you'll need:</p>
                        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                          {type === "whatsapp" && <>
                            <li>A Meta Business account</li>
                            <li>WhatsApp Business API access (via Meta)</li>
                            <li>A verified WhatsApp phone number</li>
                          </>}
                          {type === "facebook" && <>
                            <li>A Facebook Business Page</li>
                            <li>A Meta Developer App</li>
                            <li>Messenger API permissions</li>
                          </>}
                          {type === "instagram" && <>
                            <li>An Instagram Business account</li>
                            <li>Connected to a Facebook Page</li>
                            <li>Instagram Messaging API permissions</li>
                          </>}
                        </ul>
                        <a href={meta.docsUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-xs mt-1">
                          View setup guide <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>

                      <Button onClick={() => createMutation.mutate({ type })} disabled={createMutation.isPending} className="gap-2">
                        {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Add {meta.label}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
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
