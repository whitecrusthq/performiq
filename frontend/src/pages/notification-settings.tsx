import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Bell, Mail, MessageSquare, Phone, Send, Globe, Smartphone,
  Settings2, CheckCircle2, XCircle, ChevronRight, Shield, Zap, FlaskConical,
  Search, UserCheck
} from "lucide-react";

function authHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const PLATFORM_META: Record<string, { icon: any; color: string; description: string; category: string }> = {
  mailgun: { icon: Mail, color: "#F06B59", description: "Transactional email through Mailgun API or SMTP", category: "Email" },
  smtp: { icon: Mail, color: "#3B82F6", description: "Send emails through any SMTP server", category: "Email" },
  twilio: { icon: Phone, color: "#F22F46", description: "Send SMS notifications via Twilio", category: "SMS" },
  slack: { icon: MessageSquare, color: "#4A154B", description: "Post notifications to Slack channels", category: "Chat" },
  teams: { icon: MessageSquare, color: "#6264A7", description: "Send notifications to Microsoft Teams", category: "Chat" },
  whatsapp: { icon: Smartphone, color: "#25D366", description: "Send WhatsApp messages via Twilio", category: "Messaging" },
  telegram: { icon: Send, color: "#0088CC", description: "Send messages via Telegram Bot API", category: "Messaging" },
  firebase: { icon: Bell, color: "#FFCA28", description: "Push notifications via Firebase Cloud Messaging", category: "Push" },
  webhook: { icon: Globe, color: "#6366F1", description: "Send events to any custom HTTP endpoint", category: "Integration" },
};

const FIELD_LABELS: Record<string, string> = {
  authMode: "Authentication Method", apiKey: "API Key", domain: "Domain", fromEmail: "From Email",
  host: "SMTP Host", port: "Port", username: "SMTP Username", password: "SMTP Password", encryption: "Encryption",
  accountSid: "Account SID", authToken: "Auth Token", fromNumber: "From Number",
  webhookUrl: "Webhook URL", channel: "Channel", botToken: "Bot Token",
  chatId: "Chat ID", serviceAccountJson: "Service Account JSON", projectId: "Project ID",
  url: "Webhook URL", method: "HTTP Method", headers: "Headers (JSON)", secret: "Signing Secret",
};

const SENSITIVE_FIELDS = ["apiKey", "authToken", "password", "botToken", "secret", "serviceAccountJson"];

interface PlatformDef { key: string; label: string; fields: string[]; }
interface AdministrativeRecipient {
  id: number;
  name: string;
  email: string;
  role: string;
  isProtected: boolean;
  selected: boolean;
}

export default function NotificationSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const [editPlatform, setEditPlatform] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [formEnabled, setFormEnabled] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<Set<number>>(new Set());

  const platforms = useQuery<PlatformDef[]>({
    queryKey: ["notification-platforms"],
    queryFn: () => apiFetch("/api/notification-settings/platforms", { headers: authHeader() }).then(r => r.json()),
  });

  const settings = useQuery<Record<string, any>>({
    queryKey: ["notification-settings"],
    queryFn: () => apiFetch("/api/notification-settings", { headers: authHeader() }).then(r => r.json()),
  });

  const administrativeRecipients = useQuery<AdministrativeRecipient[]>({
    queryKey: ["administrative-notification-recipients"],
    enabled: user?.role === "super_admin",
    queryFn: () => apiFetch("/api/notification-settings/admin-recipients/list")
      .then(r => r.ok ? r.json() : r.json().then((e: any) => Promise.reject(e.error))),
  });

  useEffect(() => {
    if (administrativeRecipients.data) {
      setSelectedRecipientIds(new Set(administrativeRecipients.data.filter(recipient => recipient.selected).map(recipient => recipient.id)));
    }
  }, [administrativeRecipients.data]);

  const saveRecipients = useMutation({
    mutationFn: () => apiFetch("/api/notification-settings/admin-recipients/list", {
      method: "PUT",
      body: JSON.stringify({ userIds: [...selectedRecipientIds] }),
    }).then(r => r.ok ? r.json() : r.json().then((e: any) => Promise.reject(e.error))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["administrative-notification-recipients"] });
      toast({ title: "Recipients saved", description: "Administrative alerts will be sent to the selected administrators." });
    },
    onError: (e: any) => toast({ title: "Could not save recipients", description: String(e), variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: (data: { platform: string; enabled: boolean; config: Record<string, string> }) =>
      apiFetch(`/api/notification-settings/${data.platform}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ enabled: data.enabled, config: data.config }),
      }).then(r => r.ok ? r.json() : r.json().then((e: any) => Promise.reject(e.error))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-settings"] });
      setEditPlatform(null);
      toast({ title: "Settings saved", description: "Notification platform configuration updated." });
    },
    onError: (e: any) => toast({ title: "Error", description: String(e), variant: "destructive" }),
  });

  const testMutation = useMutation({
    mutationFn: (platform: string) =>
      apiFetch(`/api/notification-settings/${platform}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
      }).then(r => r.json().then(data => r.ok ? data : Promise.reject(data.error))),
    onSuccess: (data: any) => toast({ title: "Test Result", description: data.message }),
    onError: (e: any) => toast({ title: "Test Failed", description: String(e), variant: "destructive" }),
  });

  const openEdit = (platformKey: string) => {
    const current = settings.data?.[platformKey];
    const config = (current?.config || {}) as Record<string, string>;
    setFormValues({ ...config });
    setFormEnabled(current?.enabled || false);
    setEditPlatform(platformKey);
  };

  const handleSave = () => {
    if (!editPlatform) return;
    saveMutation.mutate({ platform: editPlatform, enabled: formEnabled, config: formValues });
  };

  const enabledCount = settings.data
    ? Object.values(settings.data).filter((s: any) => s.enabled).length
    : 0;

  if (!isAdmin) {
    return <div className="p-8 text-center text-muted-foreground">You do not have permission to view this page.</div>;
  }

  const editPlatformDef = platforms.data?.find(p => p.key === editPlatform);
  const editMeta = editPlatform ? PLATFORM_META[editPlatform] : null;

  const categories = ["Email", "SMS", "Chat", "Messaging", "Push", "Integration"];
  const filteredRecipients = (administrativeRecipients.data ?? []).filter(recipient => {
    const term = recipientSearch.trim().toLowerCase();
    return !term || recipient.name.toLowerCase().includes(term) || recipient.email.toLowerCase().includes(term);
  });
  const allFilteredRecipientsSelected = filteredRecipients.length > 0
    && filteredRecipients.every(recipient => selectedRecipientIds.has(recipient.id));
  const toggleRecipient = (id: number) => setSelectedRecipientIds(previous => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAllRecipients = () => setSelectedRecipientIds(previous => {
    if (allFilteredRecipientsSelected) {
      const next = new Set(previous);
      filteredRecipients.forEach(recipient => next.delete(recipient.id));
      return next;
    }
    return new Set([...previous, ...filteredRecipients.map(recipient => recipient.id)]);
  });

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <PageHeader
        title="Notifications"
        description="Configure third-party notification platforms for email, SMS, chat, and push notifications."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{platforms.data?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Available Platforms</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{enabledCount}</p>
                <p className="text-xs text-muted-foreground">Active Platforms</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{(platforms.data?.length || 0) - enabledCount}</p>
                <p className="text-xs text-muted-foreground">Inactive Platforms</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {user?.role === "super_admin" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Administrative Alert Recipients
              {selectedRecipientIds.size > 0 && <Badge variant="secondary">{selectedRecipientIds.size} selected</Badge>}
            </CardTitle>
            <CardDescription>
              Choose the active administrators who should receive account-lock and account-recovery alerts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={recipientSearch}
                  onChange={event => setRecipientSearch(event.target.value)}
                  placeholder="Search administrators"
                  className="pl-9"
                />
              </div>
              <Button variant="outline" onClick={toggleAllRecipients} disabled={filteredRecipients.length === 0}>
                {allFilteredRecipientsSelected ? "Clear filtered" : "Select all filtered"}
              </Button>
            </div>

            {administrativeRecipients.isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading administrators…</p>
            ) : filteredRecipients.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No active administrators match this search.</p>
            ) : (
              <div className="max-h-72 divide-y overflow-y-auto rounded-lg border">
                {filteredRecipients.map(recipient => (
                  <label key={recipient.id} className="flex cursor-pointer items-center gap-3 p-3 hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={selectedRecipientIds.has(recipient.id)}
                      onChange={() => toggleRecipient(recipient.id)}
                      className="h-4 w-4 accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{recipient.name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {recipient.role === "super_admin" ? "Super Admin" : "Admin"}
                        </Badge>
                        {recipient.isProtected && <Badge variant="secondary" className="text-[10px]">Protected</Badge>}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{recipient.email}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                If nobody is selected, administrative alerts are not sent.
              </p>
              <Button onClick={() => saveRecipients.mutate()} disabled={saveRecipients.isPending || administrativeRecipients.isLoading}>
                {saveRecipients.isPending ? "Saving…" : "Save Recipients"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {categories.map(cat => {
        const catPlatforms = platforms.data?.filter(p => PLATFORM_META[p.key]?.category === cat) || [];
        if (catPlatforms.length === 0) return null;
        return (
          <div key={cat} className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{cat}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {catPlatforms.map(p => {
                const meta = PLATFORM_META[p.key];
                const platformSettings = settings.data?.[p.key];
                const isEnabled = platformSettings?.enabled;
                const Icon = meta?.icon || Globe;
                const hasConfig = platformSettings?.config && Object.keys(platformSettings.config).length > 0;

                return (
                  <Card
                    key={p.key}
                    className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
                    style={{ borderLeftColor: isEnabled ? meta?.color || "#888" : "transparent" }}
                    onClick={() => openEdit(p.key)}
                  >
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${meta?.color}18` }}
                        >
                          <Icon className="h-5 w-5" style={{ color: meta?.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{p.label}</span>
                            {isEnabled ? (
                              <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-green-600 hover:bg-green-600">Active</Badge>
                            ) : hasConfig ? (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Configured</Badge>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{meta?.description}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      <Dialog open={!!editPlatform} onOpenChange={open => !open && setEditPlatform(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {editMeta && (
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${editMeta.color}18` }}
                >
                  <editMeta.icon className="h-5 w-5" style={{ color: editMeta.color }} />
                </div>
              )}
              <div>
                <DialogTitle>{editPlatformDef?.label || ""} Configuration</DialogTitle>
                <DialogDescription>{editMeta?.description}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Enable Platform</Label>
              </div>
              <Switch checked={formEnabled} onCheckedChange={setFormEnabled} />
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Connection Details</span>
              </div>

              {editPlatformDef?.fields.map(field => {
                if (editPlatform === "mailgun") {
                  const authMode = formValues.authMode || "api";
                  if (authMode === "api" && ["username", "password", "host", "port", "encryption"].includes(field)) return null;
                  if (authMode === "smtp" && field === "apiKey") return null;
                }
                const isSensitive = SENSITIVE_FIELDS.includes(field);
                const isLargeField = field === "serviceAccountJson" || field === "headers";

                if (field === "authMode") {
                  return (
                    <div key={field} className="space-y-1.5">
                      <Label className="text-sm">{FIELD_LABELS[field]}</Label>
                      <Select
                        value={formValues[field] || "api"}
                        onValueChange={val => setFormValues(prev => ({ ...prev, [field]: val }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="api">Private API Key</SelectItem>
                          <SelectItem value="smtp">SMTP Username & Password</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  );
                }

                if (field === "encryption") {
                  return (
                    <div key={field} className="space-y-1.5">
                      <Label className="text-sm">{FIELD_LABELS[field] || field}</Label>
                      <Select
                        value={formValues[field] || "tls"}
                        onValueChange={val => setFormValues(prev => ({ ...prev, [field]: val }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="tls">TLS</SelectItem>
                          <SelectItem value="ssl">SSL</SelectItem>
                          <SelectItem value="starttls">STARTTLS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  );
                }

                if (field === "method") {
                  return (
                    <div key={field} className="space-y-1.5">
                      <Label className="text-sm">{FIELD_LABELS[field] || field}</Label>
                      <Select
                        value={formValues[field] || "POST"}
                        onValueChange={val => setFormValues(prev => ({ ...prev, [field]: val }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="POST">POST</SelectItem>
                          <SelectItem value="PUT">PUT</SelectItem>
                          <SelectItem value="PATCH">PATCH</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  );
                }

                if (isLargeField) {
                  return (
                    <div key={field} className="space-y-1.5">
                      <Label className="text-sm">{FIELD_LABELS[field] || field}</Label>
                      <Textarea
                        value={formValues[field] || ""}
                        onChange={e => setFormValues(prev => ({ ...prev, [field]: e.target.value }))}
                        placeholder={field === "headers" ? '{"Authorization": "Bearer ..."}' : "Paste JSON here..."}
                        rows={4}
                        className="font-mono text-xs"
                      />
                    </div>
                  );
                }

                return (
                  <div key={field} className="space-y-1.5">
                    <Label className="text-sm">{FIELD_LABELS[field] || field}</Label>
                    <Input
                      type={isSensitive ? "password" : "text"}
                      value={formValues[field] || ""}
                      onChange={e => setFormValues(prev => ({ ...prev, [field]: e.target.value }))}
                      placeholder={FIELD_LABELS[field] || field}
                    />
                    {isSensitive && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Shield className="h-3 w-3" /> Stored securely. Leave blank to keep existing value.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="flex-1">
                {saveMutation.isPending ? "Saving..." : "Save Configuration"}
              </Button>
              {formEnabled && (
                <Button
                  variant="outline"
                  onClick={() => editPlatform && testMutation.mutate(editPlatform)}
                  disabled={testMutation.isPending}
                >
                  <FlaskConical className="h-4 w-4 mr-1" />
                  {testMutation.isPending ? "Testing..." : "Test"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
