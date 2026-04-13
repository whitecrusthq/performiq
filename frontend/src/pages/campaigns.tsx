import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getChannelIcon, getChannelColor, getChannelMeta } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Search, Megaphone, Calendar, Send, BarChart2, Loader2,
  Users, Trash2, Pencil, Zap, UserCheck, ChevronDown, X, Filter,
} from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface ApiCampaign {
  id: number;
  name: string;
  channel: string;
  status: "draft" | "scheduled" | "sent";
  message: string;
  recipients: number;
  sentAt: string | null;
  scheduledAt: string | null;
  openRate: number;
  clickRate: number;
}

interface CustomerGroup {
  id: number;
  name: string;
  description: string | null;
  type: "smart" | "manual";
  filters: { channels?: string[]; activeWithinDays?: number | null; hasOpenConversation?: boolean } | null;
  memberCount: number;
  createdAt: string;
}

interface CustomerRow {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  channel: string;
}

const ALL_CHANNELS = [
  { value: "whatsapp",  label: "WhatsApp" },
  { value: "facebook",  label: "Facebook Messenger" },
  { value: "instagram", label: "Instagram Direct" },
  { value: "sms",       label: "SMS" },
  { value: "email",     label: "Email" },
  { value: "push",      label: "Push Notification" },
  { value: "tiktok",    label: "TikTok" },
];

const CONTACT_CHANNELS = [
  { value: "whatsapp",  label: "WhatsApp" },
  { value: "facebook",  label: "Facebook" },
  { value: "instagram", label: "Instagram" },
];

const ACTIVE_OPTIONS = [
  { value: "none", label: "Any time" },
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

function getStatusBadge(status: string) {
  switch (status) {
    case "sent":      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none">Sent</Badge>;
    case "scheduled": return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-none">Scheduled</Badge>;
    case "draft":     return <Badge variant="outline" className="text-muted-foreground">Draft</Badge>;
    default:          return null;
  }
}

export default function Campaigns() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("campaigns");

  // ── Campaign state ──────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewCampOpen, setIsNewCampOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newChannel, setNewChannel] = useState("whatsapp");
  const [newMessage, setNewMessage] = useState("");
  const [newGroupId, setNewGroupId] = useState("all");

  // ── Group state ──────────────────────────────────────────────────
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [groupType, setGroupType] = useState<"smart" | "manual">("manual");
  const [smartChannels, setSmartChannels] = useState<string[]>([]);
  const [smartActiveDays, setSmartActiveDays] = useState("");
  const [smartOpenOnly, setSmartOpenOnly] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<Set<number>>(new Set());
  const [groupSearch, setGroupSearch] = useState("");
  const [groupChannelFilter, setGroupChannelFilter] = useState<string>("all");
  const [groupTypeFilter, setGroupTypeFilter] = useState<string>("all");
  const [deleteGroupId, setDeleteGroupId] = useState<number | null>(null);

  // ── Queries ──────────────────────────────────────────────────────
  const { data: campaigns = [], isLoading } = useQuery<ApiCampaign[]>({
    queryKey: ["campaigns"],
    queryFn: () => apiGet("/campaigns"),
  });

  const { data: groups = [], isLoading: groupsLoading } = useQuery<CustomerGroup[]>({
    queryKey: ["customer-groups"],
    queryFn: () => apiGet("/customer-groups"),
  });

  const { data: allCustomers = [] } = useQuery<CustomerRow[]>({
    queryKey: ["customers-list-picker"],
    queryFn: async () => {
      const res: any = await apiGet("/customers?limit=500");
      return Array.isArray(res) ? res : (res?.customers ?? []);
    },
    enabled: showGroupDialog && groupType === "manual",
  });

  const filteredPickerCustomers = allCustomers.filter((c) =>
    !memberSearch || c.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    (c.email ?? "").toLowerCase().includes(memberSearch.toLowerCase()) ||
    (c.phone ?? "").includes(memberSearch)
  );

  const [sendCampaignId, setSendCampaignId] = useState<number | null>(null);
  const [deleteCampaignId, setDeleteCampaignId] = useState<number | null>(null);

  const { data: channelsStatus } = useQuery<{
    email: { configured: boolean; provider: string };
    sms: { configured: boolean; provider: string };
    whatsapp: { configured: boolean; provider: string };
  }>({
    queryKey: ["campaigns-channels-status"],
    queryFn: () => apiGet("/campaigns/channels-status"),
  });

  // ── Campaign mutations ───────────────────────────────────────────
  const createCampaignMutation = useMutation({
    mutationFn: (data: { name: string; channel: string; message: string; status: string; groupId?: string }) =>
      apiPost("/campaigns", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      setIsNewCampOpen(false);
      setNewName(""); setNewChannel("whatsapp"); setNewMessage(""); setNewGroupId("all");
      toast({ title: "Campaign created" });
    },
  });

  const sendCampaignMutation = useMutation({
    mutationFn: (id: number) => apiPost<{ ok: boolean; sent: number; failed: number; errors?: string[] }>(`/campaigns/${id}/send`, {}),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      setSendCampaignId(null);
      const failMsg = data.failed > 0 ? ` (${data.failed} failed)` : "";
      toast({ title: "Campaign sent!", description: `${data.sent} messages delivered${failMsg}` });
    },
    onError: (err: any) => {
      toast({ title: "Send failed", description: err?.message || "Could not send campaign", variant: "destructive" });
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: (id: number) => apiDelete(`/campaigns/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      setDeleteCampaignId(null);
      toast({ title: "Campaign deleted" });
    },
  });

  // ── Group mutations ──────────────────────────────────────────────
  const createGroupMutation = useMutation({
    mutationFn: (data: any) => apiPost("/customer-groups", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-groups"] });
      closeGroupDialog();
      toast({ title: "Group created" });
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiPut(`/customer-groups/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-groups"] });
      closeGroupDialog();
      toast({ title: "Group updated" });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id: number) => apiDelete(`/customer-groups/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-groups"] });
      setDeleteGroupId(null);
      toast({ title: "Group deleted" });
    },
  });

  function openNewGroup() {
    setEditingGroup(null);
    setGroupName(""); setGroupDesc(""); setGroupType("manual");
    setSmartChannels([]); setSmartActiveDays("none"); setSmartOpenOnly(false);
    setSelectedMembers(new Set()); setMemberSearch("");
    setShowGroupDialog(true);
  }

  function openEditGroup(g: CustomerGroup) {
    setEditingGroup(g);
    setGroupName(g.name); setGroupDesc(g.description ?? ""); setGroupType(g.type);
    setSmartChannels(g.filters?.channels ?? []);
    setSmartActiveDays(g.filters?.activeWithinDays ? String(g.filters.activeWithinDays) : "none");
    setSmartOpenOnly(g.filters?.hasOpenConversation ?? false);
    setSelectedMembers(new Set()); setMemberSearch("");
    setShowGroupDialog(true);
    if (g.type === "manual") {
      apiGet<{ members: CustomerRow[] }>(`/customer-groups/${g.id}`).then((res: any) => {
        setSelectedMembers(new Set(res.members?.map((m: CustomerRow) => m.id) ?? []));
      }).catch(() => {});
    }
  }

  function closeGroupDialog() {
    setShowGroupDialog(false);
    setEditingGroup(null);
  }

  function toggleSmartChannel(ch: string) {
    setSmartChannels((prev) => prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]);
  }

  function toggleMember(id: number) {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleSaveGroup() {
    if (!groupName.trim()) {
      toast({ title: "Group name is required", variant: "destructive" }); return;
    }
    const payload: any = {
      name: groupName.trim(),
      description: groupDesc.trim() || null,
      type: groupType,
      filters: groupType === "smart" ? {
        channels: smartChannels.length > 0 ? smartChannels : undefined,
        activeWithinDays: smartActiveDays && smartActiveDays !== "none" ? parseInt(smartActiveDays) : null,
        hasOpenConversation: smartOpenOnly || undefined,
      } : null,
      memberIds: groupType === "manual" ? Array.from(selectedMembers) : undefined,
    };
    if (editingGroup) {
      updateGroupMutation.mutate({ id: editingGroup.id, ...payload });
    } else {
      createGroupMutation.mutate(payload);
    }
  }

  const filteredCampaigns = campaigns.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredGroups = groups.filter((g) => {
    if (groupSearch && !g.name.toLowerCase().includes(groupSearch.toLowerCase())) return false;
    if (groupTypeFilter !== "all" && g.type !== groupTypeFilter) return false;
    if (groupChannelFilter !== "all") {
      if (g.type === "smart") {
        const chs = g.filters?.channels ?? [];
        if (chs.length > 0 && !chs.includes(groupChannelFilter)) return false;
      }
    }
    return true;
  });
  const sentCampaigns = campaigns.filter((c) => c.status === "sent");
  const avgOpenRate = sentCampaigns.length > 0
    ? (sentCampaigns.reduce((s, c) => s + c.openRate, 0) / sentCampaigns.length).toFixed(1)
    : "0.0";

  const isSaving = createGroupMutation.isPending || updateGroupMutation.isPending;

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground mt-1">Broadcast messages to your customer segments.</p>
        </div>
        <div className="flex gap-2">
          {tab === "groups" && (
            <Button variant="outline" className="gap-2" onClick={openNewGroup}>
              <Plus className="h-4 w-4" /> New Group
            </Button>
          )}
          <Button className="gap-2" data-testid="button-new-campaign" onClick={() => setIsNewCampOpen(true)}>
            <Plus className="h-4 w-4" /> New Campaign
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mb-4 shrink-0 w-fit bg-muted/60">
          <TabsTrigger value="campaigns" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Megaphone className="h-4 w-4" /> Campaigns
          </TabsTrigger>
          <TabsTrigger value="groups" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="h-4 w-4" /> Customer Groups
            {groups.length > 0 && (
              <span className="ml-1 h-4 min-w-4 px-1 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">
                {groups.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── CAMPAIGNS TAB ───────────────────────────────────────────── */}
        <TabsContent value="campaigns" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
          <div className="grid gap-6 md:grid-cols-3 mb-6 shrink-0">
            <Card>
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Total Sent</p>
                  <h3 className="text-2xl font-bold">{sentCampaigns.length}</h3>
                </div>
                <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                  <Megaphone className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Avg Open Rate</p>
                  <h3 className="text-2xl font-bold">{avgOpenRate}%</h3>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                  <BarChart2 className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Active Scheduled</p>
                  <h3 className="text-2xl font-bold">{campaigns.filter((c) => c.status === "scheduled").length}</h3>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                  <Calendar className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mb-4 shrink-0">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">By Channel</h2>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-7">
              {ALL_CHANNELS.map((ch) => {
                const Icon = getChannelIcon(ch.value);
                const meta = getChannelMeta(ch.value);
                const count = campaigns.filter((c) => c.channel === ch.value).length;
                return (
                  <Card key={ch.value} className={`border ${meta.border} ${meta.bg}`}>
                    <CardContent className="p-4 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${meta.textColor}`} />
                        <span className="text-xs font-medium text-muted-foreground truncate">{ch.label}</span>
                      </div>
                      <p className="text-2xl font-bold">{count}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <Card className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between shrink-0 bg-muted/20">
              <div className="relative w-80">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search campaigns..." className="pl-9 bg-background" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} data-testid="input-search-campaigns" />
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Recipients</TableHead>
                    <TableHead className="text-right">Open Rate</TableHead>
                    <TableHead className="text-right">Click Rate</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                  ) : filteredCampaigns.map((campaign) => {
                    const Icon = getChannelIcon(campaign.channel);
                    return (
                      <TableRow key={campaign.id} data-testid={`campaign-row-${campaign.id}`}>
                        <TableCell className="font-medium">{campaign.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Icon className={`h-4 w-4 ${getChannelColor(campaign.channel)}`} />
                            <span>{getChannelMeta(campaign.channel).label}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {campaign.sentAt ? format(new Date(campaign.sentAt), "MMM d, yyyy") : "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm">{campaign.recipients.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-sm">{campaign.status === "sent" ? `${campaign.openRate}%` : "—"}</TableCell>
                        <TableCell className="text-right text-sm">{campaign.status === "sent" ? `${campaign.clickRate}%` : "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {campaign.status !== "sent" && ["email", "sms", "whatsapp"].includes(campaign.channel) && (
                              <Button
                                variant="default"
                                size="sm"
                                className="gap-1 h-7 text-xs"
                                onClick={() => setSendCampaignId(campaign.id)}
                              >
                                <Send className="h-3 w-3" /> Send
                              </Button>
                            )}
                            {campaign.status !== "sent" && (
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => setDeleteCampaignId(campaign.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!isLoading && filteredCampaigns.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No campaigns found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ── GROUPS TAB ──────────────────────────────────────────────── */}
        <TabsContent value="groups" className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden">
          <div className="space-y-4">
            {/* Search + filters row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search groups..." className="pl-9" value={groupSearch} onChange={(e) => setGroupSearch(e.target.value)} />
              </div>

              {/* Type filter pills */}
              <div className="flex items-center gap-1.5">
                {[
                  { value: "all",    label: "All Types" },
                  { value: "smart",  label: "⚡ Smart" },
                  { value: "manual", label: "✓ Manual" },
                ].map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setGroupTypeFilter(t.value)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                      groupTypeFilter === t.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Channel filter pills */}
              <div className="flex items-center gap-1.5">
                {[
                  { value: "all",       label: "All Channels" },
                  { value: "whatsapp",  label: "WhatsApp" },
                  { value: "facebook",  label: "Facebook" },
                  { value: "instagram", label: "Instagram" },
                ].map((ch) => (
                  <button
                    key={ch.value}
                    type="button"
                    onClick={() => setGroupChannelFilter(ch.value)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                      groupChannelFilter === ch.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>

              <p className="text-xs text-muted-foreground ml-auto">{filteredGroups.length} of {groups.length} group{groups.length !== 1 ? "s" : ""}</p>
            </div>

            {groupsLoading ? (
              <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : filteredGroups.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <Users className="h-12 w-12 mx-auto text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm">No customer groups yet.</p>
                <p className="text-xs text-muted-foreground">Create a group to target specific customers in campaigns.</p>
                <Button variant="outline" className="gap-2 mt-2" onClick={openNewGroup}>
                  <Plus className="h-4 w-4" /> Create First Group
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredGroups.map((g) => (
                  <Card key={g.id} className="group hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${g.type === "smart" ? "bg-purple-100 dark:bg-purple-900/30" : "bg-blue-100 dark:bg-blue-900/30"}`}>
                            {g.type === "smart"
                              ? <Zap className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                              : <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            }
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{g.name}</p>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 mt-0.5 ${g.type === "smart" ? "border-purple-300 text-purple-600" : "border-blue-300 text-blue-600"}`}>
                              {g.type === "smart" ? "Smart" : "Manual"}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditGroup(g)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setDeleteGroupId(g.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {g.description && (
                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{g.description}</p>
                      )}
                      {g.type === "smart" && g.filters && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {g.filters.channels?.map((ch) => (
                            <Badge key={ch} variant="secondary" className="text-[10px] px-1.5 capitalize">{ch}</Badge>
                          ))}
                          {g.filters.activeWithinDays && (
                            <Badge variant="secondary" className="text-[10px] px-1.5">Active {g.filters.activeWithinDays}d</Badge>
                          )}
                          {g.filters.hasOpenConversation && (
                            <Badge variant="secondary" className="text-[10px] px-1.5">Open conv.</Badge>
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-3 border-t">
                        <div className="flex items-center gap-1.5 text-sm font-semibold">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{g.memberCount.toLocaleString()}</span>
                          <span className="text-xs text-muted-foreground font-normal">customer{g.memberCount !== 1 ? "s" : ""}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{format(new Date(g.createdAt), "MMM d, yyyy")}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── New Campaign Dialog ──────────────────────────────────────── */}
      <Dialog open={isNewCampOpen} onOpenChange={setIsNewCampOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create Broadcast Campaign</DialogTitle>
            <DialogDescription>Send a mass message to your customers across channels.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name</Label>
              <Input id="name" placeholder="e.g. Summer Sale 2024" value={newName} onChange={(e) => setNewName(e.target.value)} data-testid="input-campaign-name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Channel</Label>
                <Select value={newChannel} onValueChange={setNewChannel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALL_CHANNELS.map((ch) => {
                      const Icon = getChannelIcon(ch.value);
                      const meta = getChannelMeta(ch.value);
                      return (
                        <SelectItem key={ch.value} value={ch.value}>
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${meta.textColor}`} />
                            <span>{ch.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target Audience</Label>
                <Select value={newGroupId} onValueChange={setNewGroupId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Customers</SelectItem>
                    <SelectItem value="active">Active in last 30 days</SelectItem>
                    {groups.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-t mt-1 pt-2">
                          Your Groups
                        </div>
                        {groups.map((g) => (
                          <SelectItem key={g.id} value={String(g.id)}>
                            <div className="flex items-center gap-2">
                              {g.type === "smart"
                                ? <Zap className="h-3.5 w-3.5 text-purple-500" />
                                : <UserCheck className="h-3.5 w-3.5 text-blue-500" />
                              }
                              <span>{g.name}</span>
                              <span className="text-muted-foreground text-xs">({g.memberCount})</span>
                            </div>
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message Content</Label>
              <Textarea
                id="message"
                placeholder="Type your message here. Use variables like {{name}} for personalization."
                className="min-h-[150px] resize-none"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                data-testid="textarea-campaign-message"
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button variant="outline" onClick={() => createCampaignMutation.mutate({ name: newName, channel: newChannel, message: newMessage, status: "draft", groupId: newGroupId })} disabled={!newName || !newMessage}>
              Save Draft
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" className="gap-2" disabled={!newName || !newMessage} onClick={() => createCampaignMutation.mutate({ name: newName, channel: newChannel, message: newMessage, status: "scheduled", groupId: newGroupId })}>
                <Calendar className="h-4 w-4" /> Schedule
              </Button>
              <Button className="gap-2" disabled={!newName || !newMessage || createCampaignMutation.isPending} onClick={() => createCampaignMutation.mutate({ name: newName, channel: newChannel, message: newMessage, status: "draft", groupId: newGroupId })}>
                {createCampaignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Send Now</>}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create / Edit Group Dialog ───────────────────────────────── */}
      <Dialog open={showGroupDialog} onOpenChange={(o) => { if (!o) closeGroupDialog(); }}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Edit Group" : "Create Customer Group"}</DialogTitle>
            <DialogDescription>
              {groupType === "smart" ? "Customers are added automatically based on filters." : "Hand-pick specific customers to include."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-5 py-2 pr-1">
            {/* Name */}
            <div className="space-y-1.5">
              <Label>Group Name <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. Lagos Resellers, Premium Clients" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input placeholder="Short note about this group" value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} />
            </div>

            {/* Type toggle */}
            <div className="space-y-1.5">
              <Label>Group Type</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setGroupType("manual")}
                  className={`flex flex-col items-start gap-1.5 p-3.5 rounded-lg border text-left transition-all ${groupType === "manual" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                >
                  <div className="flex items-center gap-2">
                    <UserCheck className={`h-4 w-4 ${groupType === "manual" ? "text-primary" : "text-blue-500"}`} />
                    <span className="font-medium text-sm">Manual</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Hand-pick specific customers</p>
                </button>
                <button
                  type="button"
                  onClick={() => setGroupType("smart")}
                  className={`flex flex-col items-start gap-1.5 p-3.5 rounded-lg border text-left transition-all ${groupType === "smart" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                >
                  <div className="flex items-center gap-2">
                    <Zap className={`h-4 w-4 ${groupType === "smart" ? "text-primary" : "text-purple-500"}`} />
                    <span className="font-medium text-sm">Smart (Filter-based)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Auto-updates based on rules</p>
                </button>
              </div>
            </div>

            {/* Smart filters */}
            {groupType === "smart" && (
              <div className="space-y-4 p-4 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40">
                <div className="space-y-2">
                  <Label className="text-sm">Channel filter</Label>
                  <div className="flex flex-wrap gap-2">
                    {CONTACT_CHANNELS.map((ch) => {
                      const active = smartChannels.includes(ch.value);
                      return (
                        <button
                          key={ch.value}
                          type="button"
                          onClick={() => toggleSmartChannel(ch.value)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50 text-muted-foreground"}`}
                        >
                          {ch.label}
                        </button>
                      );
                    })}
                    {smartChannels.length > 0 && (
                      <button type="button" onClick={() => setSmartChannels([])} className="text-xs text-muted-foreground hover:text-destructive">Clear</button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Last activity</Label>
                  <Select value={smartActiveDays} onValueChange={setSmartActiveDays}>
                    <SelectTrigger className="bg-white dark:bg-background"><SelectValue placeholder="Any time" /></SelectTrigger>
                    <SelectContent>
                      {ACTIVE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="openConv" checked={smartOpenOnly} onCheckedChange={(v) => setSmartOpenOnly(!!v)} />
                  <label htmlFor="openConv" className="text-sm cursor-pointer">Only customers with open conversations</label>
                </div>
              </div>
            )}

            {/* Manual picker */}
            {groupType === "manual" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Select Customers</Label>
                  <span className="text-xs text-muted-foreground">{selectedMembers.size} selected</span>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input className="pl-9" placeholder="Search customers..." value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} />
                </div>
                <div className="border rounded-lg max-h-52 overflow-y-auto">
                  {filteredPickerCustomers.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">No customers found</div>
                  ) : (
                    filteredPickerCustomers.map((c) => {
                      const CIcon = getChannelIcon(c.channel);
                      const checked = selectedMembers.has(c.id);
                      return (
                        <label key={c.id} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 border-b last:border-0 transition-colors ${checked ? "bg-primary/5" : ""}`}>
                          <Checkbox checked={checked} onCheckedChange={() => toggleMember(c.id)} />
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{c.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{c.email ?? c.phone ?? ""}</p>
                          </div>
                          <CIcon className={`h-4 w-4 shrink-0 ${getChannelColor(c.channel)}`} />
                        </label>
                      );
                    })
                  )}
                </div>
                {selectedMembers.size > 0 && (
                  <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => setSelectedMembers(new Set())}>
                    Clear all selections
                  </button>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t shrink-0">
            <Button variant="outline" onClick={closeGroupDialog}>Cancel</Button>
            <Button onClick={handleSaveGroup} disabled={isSaving}>
              {isSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : editingGroup ? "Save Changes" : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Group Confirm Dialog ─────────────────────────────── */}
      <Dialog open={deleteGroupId !== null} onOpenChange={(o) => { if (!o) setDeleteGroupId(null); }}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Delete Group</DialogTitle>
            <DialogDescription>This will permanently delete the group. Campaigns using it won't be affected.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteGroupId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteGroupId && deleteGroupMutation.mutate(deleteGroupId)} disabled={deleteGroupMutation.isPending}>
              {deleteGroupMutation.isPending ? "Deleting..." : "Delete Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Send Campaign Confirm Dialog ──────────────────────────────── */}
      <Dialog open={sendCampaignId !== null} onOpenChange={(o) => { if (!o) setSendCampaignId(null); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Send className="h-5 w-5" /> Send Campaign</DialogTitle>
            <DialogDescription>
              {(() => {
                const camp = campaigns.find((c) => c.id === sendCampaignId);
                if (!camp) return "Campaign not found.";
                const ch = camp.channel;
                const isConfigured = ch === "email" ? channelsStatus?.email?.configured : ch === "sms" ? channelsStatus?.sms?.configured : ch === "whatsapp" ? channelsStatus?.whatsapp?.configured : false;
                if (!isConfigured) {
                  return `${ch === "email" ? "Mailgun (Email)" : "Twilio (" + (ch === "sms" ? "SMS" : "WhatsApp") + ")"} is not configured. Go to Settings to set it up first.`;
                }
                return `This will send "${camp.name}" via ${ch.toUpperCase()} to all customers with ${ch === "email" ? "an email address" : "a phone number"} on file. This action cannot be undone.`;
              })()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendCampaignId(null)}>Cancel</Button>
            <Button
              onClick={() => sendCampaignId && sendCampaignMutation.mutate(sendCampaignId)}
              disabled={sendCampaignMutation.isPending}
              className="gap-2"
            >
              {sendCampaignMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</> : <><Send className="h-4 w-4" /> Send Now</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Campaign Confirm Dialog ────────────────────────────── */}
      <Dialog open={deleteCampaignId !== null} onOpenChange={(o) => { if (!o) setDeleteCampaignId(null); }}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Delete Campaign</DialogTitle>
            <DialogDescription>This will permanently delete this campaign.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCampaignId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteCampaignId && deleteCampaignMutation.mutate(deleteCampaignId)} disabled={deleteCampaignMutation.isPending}>
              {deleteCampaignMutation.isPending ? "Deleting..." : "Delete Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
