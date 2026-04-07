import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SiWhatsapp, SiFacebook, SiInstagram } from "react-icons/si";
import {
  Search,
  MessageCircle,
  Bot,
  User,
  Clock,
  CheckCircle2,
  Star,
  ChevronRight,
  Target,
  TrendingUp,
  Timer,
  ThumbsUp,
  Loader2,
  X,
  Globe,
  RefreshCw,
  RotateCcw,
  Hourglass,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPut, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { format, formatDistanceToNow } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────────

interface Transcript {
  id: number;
  channel: "whatsapp" | "facebook" | "instagram";
  status: "open" | "pending" | "resolved";
  lastMessageAt: string | null;
  createdAt: string;
  customer: { id: number; name: string; phone: string; email: string | null; avatar: string | null };
  assignedAgent: { id: number; name: string; email: string; role: string } | null;
  messageCounts: { total: number; agentCount: number; botCount: number; customerCount: number };
}

interface TranscriptMessage {
  id: number;
  sender: "customer" | "agent" | "bot";
  content: string;
  createdAt: string;
}

interface TranscriptDetail {
  conversation: Transcript;
  messages: TranscriptMessage[];
  feedback: { rating: number; comment: string | null } | null;
  avgResponseMs: number | null;
}

interface AgentStat {
  agent: { id: number; name: string; email: string; role: string; avatar: string | null };
  period: string;
  totalConversations: number;
  resolvedConversations: number;
  reopenedCount: number;
  resolutionRate: number;
  reopenRate: number;
  avgHandleTimeMins: number | null;
  agentMessages: number;
  avgResponseTimeMins: number | null;
  csatScore: number | null;
  csatCount: number;
  targets: {
    conversations: number | null;
    responseTimeMins: number | null;
    resolutionRate: number | null;
    csatScore: number | null;
    reopenRate: number | null;
    handleTimeMins: number | null;
  } | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const CHANNEL_ICON = {
  whatsapp: <SiWhatsapp className="h-3.5 w-3.5 text-[#25D366]" />,
  facebook: <SiFacebook className="h-3.5 w-3.5 text-[#1877F2]" />,
  instagram: <SiInstagram className="h-3.5 w-3.5 text-[#E1306C]" />,
  website: <Globe className="h-3.5 w-3.5 text-blue-500" />,
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400" },
  ongoing: { label: "Ongoing", className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400" },
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400" },
  resolved: { label: "Resolved", className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400" },
};

function msToReadable(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.round(mins / 60)}h ${mins % 60}m`;
}

function minsToReadable(mins: number): string {
  if (mins < 60) return `${Math.round(mins)}m`;
  return `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;
}

function KpiProgress({ value, target, invert = false }: { value: number | null; target: number | null; invert?: boolean }) {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>;
  if (target === null) return <span className="text-sm font-semibold">{value}</span>;
  const pct = Math.min((invert ? target / value : value / target) * 100, 100);
  const good = invert ? value <= target : value >= target;
  return (
    <div className="space-y-1 w-full">
      <div className="flex justify-between items-baseline gap-2">
        <span className="text-sm font-semibold">{value}</span>
        <span className="text-[10px] text-muted-foreground">/ {target}</span>
      </div>
      <Progress value={pct} className={`h-1.5 ${good ? "[&>div]:bg-green-500" : "[&>div]:bg-orange-400"}`} />
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function Transcripts() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { agent: me } = useAuth();

  // Transcript tab state
  const [search, setSearch] = useState("");
  const [filterAgent, setFilterAgent] = useState("all");
  const [filterChannel, setFilterChannel] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  // KPI tab state
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const [editTarget, setEditTarget] = useState<AgentStat | null>(null);
  const [tgtConvs, setTgtConvs] = useState("");
  const [tgtRespTime, setTgtRespTime] = useState("");
  const [tgtResolution, setTgtResolution] = useState("");
  const [tgtCsat, setTgtCsat] = useState("");
  const [tgtReopenRate, setTgtReopenRate] = useState("");
  const [tgtHandleTime, setTgtHandleTime] = useState("");

  // ── Queries ────────────────────────────────────────────────────────────────

  const params = new URLSearchParams({ page: String(page), limit: "25" });
  if (search) params.set("search", search);
  if (filterAgent !== "all") params.set("agentId", filterAgent);
  if (filterChannel !== "all") params.set("channel", filterChannel);
  if (filterStatus !== "all") params.set("status", filterStatus);

  const { data: transcriptData, isLoading: txLoading } = useQuery<{
    conversations: Transcript[];
    total: number;
    totalPages: number;
    page: number;
  }>({
    queryKey: ["transcripts", search, filterAgent, filterChannel, filterStatus, page],
    queryFn: () => apiGet(`/transcripts?${params.toString()}`),
    keepPreviousData: true,
  } as Parameters<typeof useQuery>[0]);

  const { data: detail, isLoading: detailLoading } = useQuery<TranscriptDetail>({
    queryKey: ["transcript-detail", selectedId],
    queryFn: () => apiGet(`/transcripts/${selectedId}/messages`),
    enabled: !!selectedId,
  } as Parameters<typeof useQuery>[0]);

  const { data: statsData, isLoading: statsLoading } = useQuery<{ stats: AgentStat[]; period: string }>({
    queryKey: ["agent-stats", period],
    queryFn: () => apiGet(`/transcripts/agent-stats?period=${period}`),
  } as Parameters<typeof useQuery>[0]);

  const { data: agentsData } = useQuery<{ agents: Array<{ id: number; name: string }> }>({
    queryKey: ["agents-list"],
    queryFn: () => apiGet("/agents"),
  } as Parameters<typeof useQuery>[0]);

  const saveKpiMutation = useMutation({
    mutationFn: ({ agentId, data }: { agentId: number; data: Record<string, unknown> }) =>
      apiPut(`/transcripts/kpi-targets/${agentId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-stats"] });
      setEditTarget(null);
      toast({ title: "KPI targets saved!" });
    },
    onError: () => toast({ title: "Failed to save targets", variant: "destructive" }),
  });

  const bestPracticeMutation = useMutation({
    mutationFn: (p: "weekly" | "monthly") => apiPost("/transcripts/kpi-targets/best-practice", { period: p }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-stats"] });
      toast({ title: "Best-practice KPI targets applied to all agents!" });
    },
    onError: () => toast({ title: "Failed to apply defaults", variant: "destructive" }),
  });

  const openEditTarget = (stat: AgentStat) => {
    setEditTarget(stat);
    setTgtConvs(stat.targets?.conversations != null ? String(stat.targets.conversations) : "");
    setTgtRespTime(stat.targets?.responseTimeMins != null ? String(stat.targets.responseTimeMins) : "");
    setTgtResolution(stat.targets?.resolutionRate != null ? String(stat.targets.resolutionRate) : "");
    setTgtCsat(stat.targets?.csatScore != null ? String(stat.targets.csatScore) : "");
    setTgtReopenRate(stat.targets?.reopenRate != null ? String(stat.targets.reopenRate) : "");
    setTgtHandleTime(stat.targets?.handleTimeMins != null ? String(stat.targets.handleTimeMins) : "");
  };

  const handleSaveTargets = () => {
    if (!editTarget) return;
    const payload: Record<string, unknown> = { period };
    if (tgtConvs) payload.targetConversations = Number(tgtConvs);
    if (tgtRespTime) payload.targetResponseTimeMins = Number(tgtRespTime);
    if (tgtResolution) payload.targetResolutionRate = Number(tgtResolution);
    if (tgtCsat) payload.targetCsatScore = Number(tgtCsat);
    if (tgtReopenRate) payload.targetReopenRate = Number(tgtReopenRate);
    if (tgtHandleTime) payload.targetHandleTimeMins = Number(tgtHandleTime);
    saveKpiMutation.mutate({ agentId: editTarget.agent.id, data: payload });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transcripts & KPIs</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Review full chat transcripts and monitor agent performance against targets.
        </p>
      </div>

      <Tabs defaultValue="transcripts">
        <TabsList>
          <TabsTrigger value="transcripts" className="gap-2"><MessageCircle className="h-4 w-4" />Transcripts</TabsTrigger>
          <TabsTrigger value="kpis" className="gap-2"><Target className="h-4 w-4" />Agent KPIs</TabsTrigger>
        </TabsList>

        {/* ────────────────── TRANSCRIPTS TAB ────────────────── */}
        <TabsContent value="transcripts" className="mt-4">
          <div className="flex gap-4 h-[calc(100vh-220px)]">
            {/* Left: conversation list */}
            <Card className="w-96 shrink-0 flex flex-col">
              <CardHeader className="pb-3 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search by customer name or phone…"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  />
                  {search && (
                    <button onClick={() => { setSearch(""); setPage(1); }} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex gap-2 mt-2">
                  <Select value={filterChannel} onValueChange={(v) => { setFilterChannel(v); setPage(1); }}>
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="Channel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All channels</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {me?.role !== "agent" && (
                  <Select value={filterAgent} onValueChange={(v) => { setFilterAgent(v); setPage(1); }}>
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue placeholder="All agents" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All agents</SelectItem>
                      {agentsData?.agents?.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {transcriptData && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {transcriptData.total} conversations
                  </p>
                )}
              </CardHeader>

              <ScrollArea className="flex-1">
                {txLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : !transcriptData?.conversations?.length ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">No conversations found</div>
                ) : (
                  <div className="divide-y">
                    {transcriptData.conversations.map((c) => {
                      const st = STATUS_BADGE[c.status] ?? STATUS_BADGE.open;
                      return (
                        <button
                          key={c.id}
                          onClick={() => setSelectedId(c.id)}
                          className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${selectedId === c.id ? "bg-muted" : ""}`}
                        >
                          <div className="flex items-start gap-2.5">
                            <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                              <AvatarImage src={`https://i.pravatar.cc/40?u=${c.customer?.phone}`} />
                              <AvatarFallback className="text-xs">{c.customer?.name?.charAt(0) ?? "?"}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-sm font-medium truncate">{c.customer?.name ?? "Unknown"}</span>
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  {c.lastMessageAt ? formatDistanceToNow(new Date(c.lastMessageAt), { addSuffix: true }) : "—"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                {CHANNEL_ICON[c.channel]}
                                <Badge className={`text-[9px] h-4 px-1.5 border ${st.className}`}>{st.label}</Badge>
                                <span className="text-[10px] text-muted-foreground">{c.messageCounts.total} msgs</span>
                              </div>
                              {c.assignedAgent && (
                                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                  Agent: {c.assignedAgent.name}
                                </p>
                              )}
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Pagination */}
                {transcriptData && transcriptData.totalPages > 1 && (
                  <div className="flex justify-center gap-2 p-3">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                    <span className="text-xs text-muted-foreground py-2">{page} / {transcriptData.totalPages}</span>
                    <Button size="sm" variant="outline" disabled={page >= transcriptData.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                  </div>
                )}
              </ScrollArea>
            </Card>

            {/* Right: transcript viewer */}
            <Card className="flex-1 flex flex-col">
              {!selectedId ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
                  <MessageCircle className="h-10 w-10 opacity-20" />
                  <p className="text-sm">Select a conversation to view its transcript</p>
                </div>
              ) : detailLoading ? (
                <div className="flex-1 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : detail ? (
                <>
                  {/* Header */}
                  <CardHeader className="pb-3 shrink-0 border-b">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={`https://i.pravatar.cc/40?u=${detail.conversation.customer?.phone}`} />
                          <AvatarFallback>{detail.conversation.customer?.name?.charAt(0) ?? "?"}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">{detail.conversation.customer?.name}</CardTitle>
                            <Badge className={`text-[9px] h-4 px-1.5 border ${STATUS_BADGE[detail.conversation.status]?.className}`}>
                              {STATUS_BADGE[detail.conversation.status]?.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {detail.conversation.customer?.phone}
                            {detail.conversation.customer?.email && ` · ${detail.conversation.customer.email}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="flex items-center gap-1.5 justify-end">
                          {CHANNEL_ICON[detail.conversation.channel]}
                          <span className="text-xs capitalize text-muted-foreground">{detail.conversation.channel}</span>
                        </div>
                        {detail.conversation.assignedAgent && (
                          <p className="text-xs text-muted-foreground">Agent: {detail.conversation.assignedAgent.name}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(detail.conversation.createdAt), "MMM d, yyyy HH:mm")}
                        </p>
                      </div>
                    </div>

                    {/* Stats bar */}
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1">
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>{detail.messages.length} messages</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        <span>{detail.conversation.messageCounts?.customerCount ?? 0} customer</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-primary" />
                        <span>{detail.conversation.messageCounts?.agentCount ?? 0} agent</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Bot className="h-3.5 w-3.5" />
                        <span>{detail.conversation.messageCounts?.botCount ?? 0} bot</span>
                      </div>
                      {detail.avgResponseMs !== null && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Avg response: {msToReadable(detail.avgResponseMs)}</span>
                        </div>
                      )}
                      {detail.feedback && (
                        <div className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                          <span>CSAT: {detail.feedback.rating}/5</span>
                          {detail.feedback.comment && <span className="italic">"{detail.feedback.comment}"</span>}
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  {/* Messages */}
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-3 max-w-2xl mx-auto">
                      {detail.messages.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground py-8">No messages in this conversation</p>
                      ) : (
                        detail.messages.map((msg, i) => {
                          const isCustomer = msg.sender === "customer";
                          const isBot = msg.sender === "bot";
                          const showDate =
                            i === 0 ||
                            new Date(msg.createdAt).toDateString() !== new Date(detail.messages[i - 1].createdAt).toDateString();

                          return (
                            <div key={msg.id}>
                              {showDate && (
                                <div className="flex items-center gap-2 my-3">
                                  <Separator className="flex-1" />
                                  <span className="text-[10px] text-muted-foreground shrink-0">
                                    {format(new Date(msg.createdAt), "MMMM d, yyyy")}
                                  </span>
                                  <Separator className="flex-1" />
                                </div>
                              )}
                              <div className={`flex gap-2 ${isCustomer ? "justify-start" : "justify-end"}`}>
                                {isCustomer && (
                                  <Avatar className="h-6 w-6 shrink-0 mt-1">
                                    <AvatarImage src={`https://i.pravatar.cc/40?u=${detail.conversation.customer?.phone}`} />
                                    <AvatarFallback className="text-[9px]">{detail.conversation.customer?.name?.charAt(0)}</AvatarFallback>
                                  </Avatar>
                                )}
                                <div className={`max-w-[70%] ${isCustomer ? "" : ""}`}>
                                  <div
                                    className={`rounded-2xl px-3.5 py-2 text-sm ${
                                      isCustomer
                                        ? "bg-muted rounded-tl-sm"
                                        : isBot
                                        ? "bg-purple-100 text-purple-900 dark:bg-purple-950/40 dark:text-purple-200 rounded-tr-sm"
                                        : "bg-primary text-primary-foreground rounded-tr-sm"
                                    }`}
                                  >
                                    {msg.content}
                                  </div>
                                  <div className={`flex items-center gap-1 mt-0.5 ${isCustomer ? "" : "justify-end"}`}>
                                    {isBot && <Bot className="h-3 w-3 text-purple-500" />}
                                    <span className="text-[10px] text-muted-foreground">
                                      {isCustomer ? "Customer" : isBot ? "Bot" : detail.conversation.assignedAgent?.name ?? "Agent"} ·{" "}
                                      {format(new Date(msg.createdAt), "HH:mm")}
                                    </span>
                                  </div>
                                </div>
                                {!isCustomer && (
                                  <div className={`h-6 w-6 rounded-full shrink-0 mt-1 flex items-center justify-center text-[10px] font-bold ${isBot ? "bg-purple-100 text-purple-600 dark:bg-purple-950/40" : "bg-primary text-primary-foreground"}`}>
                                    {isBot ? <Bot className="h-3.5 w-3.5" /> : (detail.conversation.assignedAgent?.name?.charAt(0) ?? "A")}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </>
              ) : null}
            </Card>
          </div>
        </TabsContent>

        {/* ────────────────── AGENT KPIs TAB ────────────────── */}
        <TabsContent value="kpis" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-semibold">Agent Performance</h2>
              <p className="text-xs text-muted-foreground">Actual performance vs. set targets for the current {period === "weekly" ? "week" : "month"}.</p>
            </div>
            <div className="flex items-center gap-2">
              {me?.role !== "agent" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => bestPracticeMutation.mutate(period)}
                  disabled={bestPracticeMutation.isPending}
                  className="gap-1.5 border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-950/30"
                >
                  {bestPracticeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Apply Best Practice Defaults
                </Button>
              )}
              <Select value={period} onValueChange={(v) => setPeriod(v as "weekly" | "monthly")}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">This Week</SelectItem>
                  <SelectItem value="monthly">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Best-practice reference card */}
          {me?.role !== "agent" && (
            <div className="rounded-lg border border-violet-200 bg-violet-50/50 dark:border-violet-800/50 dark:bg-violet-950/10 p-3">
              <p className="text-xs font-medium text-violet-700 dark:text-violet-400 mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Industry Best-Practice Benchmarks
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {[
                  { label: "First Response", value: "≤ 5 min", icon: <Timer className="h-3 w-3" /> },
                  { label: "Tickets Closed", value: period === "weekly" ? "≥ 50/wk" : "≥ 200/mo", icon: <CheckCircle2 className="h-3 w-3" /> },
                  { label: "Resolution Rate", value: "≥ 85%", icon: <TrendingUp className="h-3 w-3" /> },
                  { label: "CSAT Score", value: "≥ 4.2 / 5", icon: <Star className="h-3 w-3" /> },
                  { label: "Reopen Rate", value: "≤ 5%", icon: <RotateCcw className="h-3 w-3" /> },
                  { label: "Handle Time", value: "≤ 45 min", icon: <Hourglass className="h-3 w-3" /> },
                ].map((b) => (
                  <div key={b.label} className="text-center">
                    <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                      {b.icon}<span>{b.label}</span>
                    </div>
                    <p className="text-xs font-semibold text-violet-700 dark:text-violet-400">{b.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {statsLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !statsData?.stats?.length ? (
            <Card><CardContent className="text-center py-12 text-muted-foreground">No active agents found</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {statsData.stats.map((stat) => {
                const initials = stat.agent.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <Card key={stat.agent.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Agent avatar */}
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarImage src={`https://i.pravatar.cc/80?u=${stat.agent.email}`} />
                          <AvatarFallback className="text-sm font-semibold">{initials}</AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <div>
                              <p className="font-semibold">{stat.agent.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{stat.agent.role} · {stat.agent.email}</p>
                            </div>
                            {me?.role !== "agent" && (
                              <Button size="sm" variant="outline" onClick={() => openEditTarget(stat)} className="gap-1.5 shrink-0">
                                <Target className="h-3.5 w-3.5" />
                                Set Targets
                              </Button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
                            {/* Conversations handled */}
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MessageCircle className="h-3.5 w-3.5" />
                                <span>Tickets Closed</span>
                              </div>
                              <KpiProgress value={stat.resolvedConversations} target={stat.targets?.conversations ?? null} />
                              <p className="text-[10px] text-muted-foreground">{stat.totalConversations} total handled</p>
                            </div>

                            {/* Resolution rate */}
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Resolution Rate</span>
                              </div>
                              <KpiProgress value={stat.resolutionRate} target={stat.targets?.resolutionRate ?? null} />
                              <p className="text-[10px] text-muted-foreground">target: {stat.targets?.resolutionRate != null ? `${stat.targets.resolutionRate}%` : "—"}</p>
                            </div>

                            {/* Avg response time */}
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Timer className="h-3.5 w-3.5" />
                                <span>First Response</span>
                              </div>
                              {stat.avgResponseTimeMins !== null ? (
                                <div className="space-y-1 w-full">
                                  <span className="text-sm font-semibold">{minsToReadable(stat.avgResponseTimeMins)}</span>
                                  {stat.targets?.responseTimeMins != null && (
                                    <Progress
                                      value={Math.min((stat.targets.responseTimeMins / stat.avgResponseTimeMins) * 100, 100)}
                                      className={`h-1.5 ${stat.avgResponseTimeMins <= stat.targets.responseTimeMins ? "[&>div]:bg-green-500" : "[&>div]:bg-orange-400"}`}
                                    />
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                              <p className="text-[10px] text-muted-foreground">target: {stat.targets?.responseTimeMins != null ? `≤${stat.targets.responseTimeMins}m` : "—"}</p>
                            </div>

                            {/* Reopen Rate */}
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <RotateCcw className="h-3.5 w-3.5" />
                                <span>Reopen Rate</span>
                              </div>
                              <div className="space-y-1 w-full">
                                <div className="flex justify-between items-baseline gap-2">
                                  <span className="text-sm font-semibold">{stat.reopenRate}%</span>
                                  {stat.targets?.reopenRate != null && <span className="text-[10px] text-muted-foreground">/ ≤{stat.targets.reopenRate}%</span>}
                                </div>
                                {stat.targets?.reopenRate != null && (
                                  <Progress
                                    value={Math.min((stat.targets.reopenRate / Math.max(stat.reopenRate, 0.1)) * 100, 100)}
                                    className={`h-1.5 ${stat.reopenRate <= stat.targets.reopenRate ? "[&>div]:bg-green-500" : "[&>div]:bg-orange-400"}`}
                                  />
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground">{stat.reopenedCount} reopened</p>
                            </div>

                            {/* Handle Time */}
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Hourglass className="h-3.5 w-3.5" />
                                <span>Handle Time</span>
                              </div>
                              {stat.avgHandleTimeMins !== null ? (
                                <div className="space-y-1 w-full">
                                  <span className="text-sm font-semibold">{minsToReadable(stat.avgHandleTimeMins)}</span>
                                  {stat.targets?.handleTimeMins != null && (
                                    <Progress
                                      value={Math.min((stat.targets.handleTimeMins / stat.avgHandleTimeMins) * 100, 100)}
                                      className={`h-1.5 ${stat.avgHandleTimeMins <= stat.targets.handleTimeMins ? "[&>div]:bg-green-500" : "[&>div]:bg-orange-400"}`}
                                    />
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                              <p className="text-[10px] text-muted-foreground">target: {stat.targets?.handleTimeMins != null ? `≤${stat.targets.handleTimeMins}m` : "—"}</p>
                            </div>

                            {/* CSAT */}
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <ThumbsUp className="h-3.5 w-3.5" />
                                <span>CSAT Score</span>
                              </div>
                              {stat.csatScore !== null ? (
                                <div>
                                  <span className="text-sm font-semibold">{stat.csatScore} <span className="text-xs font-normal text-muted-foreground">/ 5</span></span>
                                  <StarRating rating={Math.round(stat.csatScore)} />
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">No ratings</span>
                              )}
                              <p className="text-[10px] text-muted-foreground">{stat.csatCount} rating{stat.csatCount !== 1 ? "s" : ""} · target: {stat.targets?.csatScore != null ? `≥${stat.targets.csatScore}` : "—"}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-6 text-xs text-muted-foreground pt-2">
            <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-green-500" /><span>At or above target</span></div>
            <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-orange-400" /><span>Below target</span></div>
            <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-muted-foreground/30" /><span>No target set</span></div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Edit KPI Targets Dialog ── */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Set KPI Targets — {editTarget?.agent.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Set performance targets for the <strong>{period === "weekly" ? "weekly" : "monthly"}</strong> period.
              Leave a field blank to keep the existing value.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5 text-sm">
                  <MessageCircle className="h-3.5 w-3.5" /> Tickets Closed (target)
                </Label>
                <Input
                  type="number"
                  min={1}
                  placeholder={`e.g. ${period === "weekly" ? "50" : "200"}`}
                  value={tgtConvs}
                  onChange={(e) => setTgtConvs(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground mt-1">Min resolved tickets this {period === "weekly" ? "week" : "month"} · BP: {period === "weekly" ? "50" : "200"}</p>
              </div>
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5 text-sm">
                  <Timer className="h-3.5 w-3.5" /> First Response (mins, max)
                </Label>
                <Input
                  type="number"
                  min={0.5}
                  step={0.5}
                  placeholder="e.g. 5"
                  value={tgtRespTime}
                  onChange={(e) => setTgtRespTime(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground mt-1">Max avg first response time · BP: 5 min</p>
              </div>
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5 text-sm">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Resolution Rate (%, min)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="e.g. 85"
                  value={tgtResolution}
                  onChange={(e) => setTgtResolution(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground mt-1">Min % of conversations resolved · BP: 85%</p>
              </div>
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5 text-sm">
                  <Star className="h-3.5 w-3.5" /> CSAT Score (1–5, min)
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  step={0.1}
                  placeholder="e.g. 4.2"
                  value={tgtCsat}
                  onChange={(e) => setTgtCsat(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground mt-1">Min average customer rating · BP: 4.2</p>
              </div>
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5 text-sm">
                  <RotateCcw className="h-3.5 w-3.5" /> Reopen Rate (%, max)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  placeholder="e.g. 5"
                  value={tgtReopenRate}
                  onChange={(e) => setTgtReopenRate(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground mt-1">Max % of tickets reopened after resolve · BP: 5%</p>
              </div>
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5 text-sm">
                  <Hourglass className="h-3.5 w-3.5" /> Handle Time (mins, max)
                </Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  placeholder="e.g. 45"
                  value={tgtHandleTime}
                  onChange={(e) => setTgtHandleTime(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground mt-1">Max avg time to close a ticket · BP: 45 min</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={handleSaveTargets} disabled={saveKpiMutation.isPending} className="gap-2">
              {saveKpiMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Targets
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
