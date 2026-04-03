import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getChannelIcon, getChannelColor, getChannelMeta } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Megaphone, Calendar, Send, BarChart2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiGet, apiPost } from "@/lib/api";
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

const ALL_CHANNELS = [
  { value: "whatsapp",  label: "WhatsApp" },
  { value: "facebook",  label: "Facebook Messenger" },
  { value: "instagram", label: "Instagram Direct" },
  { value: "sms",       label: "SMS" },
  { value: "email",     label: "Email" },
  { value: "push",      label: "Push Notification" },
  { value: "tiktok",    label: "TikTok" },
];

export default function Campaigns() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newChannel, setNewChannel] = useState("whatsapp");
  const [newMessage, setNewMessage] = useState("");

  const { data: campaigns = [], isLoading } = useQuery<ApiCampaign[]>({
    queryKey: ["campaigns"],
    queryFn: () => apiGet("/campaigns"),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; channel: string; message: string; status: string }) =>
      apiPost("/campaigns", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      setIsNewOpen(false);
      setNewName(""); setNewChannel("whatsapp"); setNewMessage("");
      toast({ title: "Campaign created", description: "Your campaign has been saved." });
    },
  });

  const filteredCampaigns = campaigns.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none">Sent</Badge>;
      case 'scheduled': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-none">Scheduled</Badge>;
      case 'draft': return <Badge variant="outline" className="text-muted-foreground">Draft</Badge>;
      default: return null;
    }
  };

  const sentCampaigns = campaigns.filter((c) => c.status === "sent");
  const avgOpenRate = sentCampaigns.length > 0
    ? (sentCampaigns.reduce((s, c) => s + c.openRate, 0) / sentCampaigns.length).toFixed(1)
    : "0.0";

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground mt-1">Broadcast messages to your customer segments.</p>
        </div>

        <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-new-campaign">
              <Plus className="h-4 w-4" /> New Campaign
            </Button>
          </DialogTrigger>
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
                  <Select defaultValue="all">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Customers</SelectItem>
                      <SelectItem value="vip">VIP Segment</SelectItem>
                      <SelectItem value="active">Active in last 30 days</SelectItem>
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
              <Button variant="outline" onClick={() => createMutation.mutate({ name: newName, channel: newChannel, message: newMessage, status: "draft" })} disabled={!newName || !newMessage}>
                Save Draft
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" className="gap-2" disabled={!newName || !newMessage} onClick={() => createMutation.mutate({ name: newName, channel: newChannel, message: newMessage, status: "scheduled" })}>
                  <Calendar className="h-4 w-4" /> Schedule
                </Button>
                <Button className="gap-2" disabled={!newName || !newMessage || createMutation.isPending} onClick={() => createMutation.mutate({ name: newName, channel: newChannel, message: newMessage, status: "draft" })}>
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Send Now</>}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-8 shrink-0">
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

      {/* Per-channel breakdown */}
      <div className="mb-6 shrink-0">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Campaigns by Channel</h2>
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
                    <TableCell className="text-right text-sm">{campaign.status === 'sent' ? `${campaign.openRate}%` : '—'}</TableCell>
                    <TableCell className="text-right text-sm">{campaign.status === 'sent' ? `${campaign.clickRate}%` : '—'}</TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm">View</Button></TableCell>
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
    </div>
  );
}
