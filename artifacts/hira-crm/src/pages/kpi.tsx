import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPut, apiPost } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Trophy, Medal, Star, TrendingUp, Clock, CheckCircle2, RotateCcw, Hourglass,
  MessageCircle, Sparkles, Target, Pencil, Loader2, ChevronDown, ChevronUp,
  Timer, Users, ArrowUp, ArrowDown, Minus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";
import { ExportButton } from "@/components/export-button";
import { exportToExcel, exportToPdf } from "@/lib/export-utils";

// ── Types ─────────────────────────────────────────────────────────────────────

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

type Period = "daily" | "weekly" | "monthly";

// ── Composite score (0–100) ───────────────────────────────────────────────────

function computeScore(stat: AgentStat): number {
  const t = stat.targets;
  const scores: number[] = [];

  const push = (actual: number | null, target: number | null, invert = false) => {
    if (actual === null || !target) return;
    const ratio = invert ? target / Math.max(actual, 0.1) : actual / target;
    scores.push(Math.min(ratio, 1.5) * 100);
  };

  push(stat.totalConversations, t?.conversations ?? null);
  push(stat.resolutionRate, t?.resolutionRate ?? null);
  push(stat.csatScore, t?.csatScore ?? null);
  push(stat.avgResponseTimeMins, t?.responseTimeMins ?? null, true);
  push(stat.reopenRate, t?.reopenRate ?? null, true);
  push(stat.avgHandleTimeMins, t?.handleTimeMins ?? null, true);

  if (scores.length === 0) {
    // No targets: use raw performance as rough score
    let raw = 0;
    if (stat.totalConversations > 0) raw += 20;
    if (stat.resolutionRate > 80) raw += 20;
    if (stat.csatScore && stat.csatScore >= 4) raw += 20;
    if (stat.avgResponseTimeMins !== null && stat.avgResponseTimeMins <= 10) raw += 20;
    if (stat.reopenRate <= 5) raw += 20;
    return raw;
  }

  return Math.min(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length), 100);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function minsLabel(v: number | null) {
  if (v === null) return "—";
  if (v < 60) return `${Math.round(v)}m`;
  return `${Math.floor(v / 60)}h ${Math.round(v % 60)}m`;
}

function scoreColor(score: number) {
  if (score >= 90) return "text-green-600 dark:text-green-400";
  if (score >= 70) return "text-blue-600 dark:text-blue-400";
  if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function scoreBar(score: number) {
  if (score >= 90) return "[&>div]:bg-green-500";
  if (score >= 70) return "[&>div]:bg-blue-500";
  if (score >= 50) return "[&>div]:bg-yellow-400";
  return "[&>div]:bg-red-500";
}

function scoreBadge(score: number) {
  if (score >= 90) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (score >= 70) return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  if (score >= 50) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
}

function rankMedal(rank: number) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
  return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{rank}</span>;
}

function KpiBar({
  label, icon: Icon, value, target, unit = "", invert = false, format: fmt,
}: {
  label: string; icon: React.ElementType; value: number | null; target: number | null;
  unit?: string; invert?: boolean; format?: (v: number) => string;
}) {
  const display = value === null ? "—" : (fmt ? fmt(value) : `${value}${unit}`);
  const tDisplay = target === null ? null : (fmt ? fmt(target) : `${target}${unit}`);

  let pct = 0;
  let good = false;
  if (value !== null && target !== null) {
    const ratio = invert ? target / Math.max(value, 0.1) : value / target;
    pct = Math.min(ratio * 100, 100);
    good = invert ? value <= target : value >= target;
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-1 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span>{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`font-semibold ${value !== null && target !== null ? (good ? "text-green-600 dark:text-green-400" : "text-orange-500") : "text-foreground"}`}>
            {display}
          </span>
          {tDisplay && <span className="text-muted-foreground/60">/ {tDisplay}</span>}
          {value !== null && target !== null && (
            good
              ? <ArrowUp className="h-3 w-3 text-green-500 shrink-0" />
              : <ArrowDown className="h-3 w-3 text-orange-400 shrink-0" />
          )}
          {(value === null || target === null) && <Minus className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
        </div>
      </div>
      {target !== null && value !== null && (
        <Progress
          value={pct}
          className={`h-1.5 ${good ? "[&>div]:bg-green-500" : "[&>div]:bg-orange-400"}`}
        />
      )}
    </div>
  );
}

// ── Agent Card ────────────────────────────────────────────────────────────────

function AgentKpiCard({ stat, rank, score, onEdit, canEdit }: {
  stat: AgentStat; rank: number; score: number; onEdit: () => void; canEdit: boolean;
}) {
  const [expanded, setExpanded] = useState(rank <= 3);
  const t = stat.targets;

  return (
    <Card className={`transition-shadow hover:shadow-md ${rank === 1 ? "ring-2 ring-yellow-400/40 dark:ring-yellow-500/30" : rank === 2 ? "ring-1 ring-gray-300 dark:ring-gray-600" : rank === 3 ? "ring-1 ring-amber-500/30" : ""}`}>
      <CardContent className="pt-4 pb-4">
        {/* Header row */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-7 shrink-0">
            {rankMedal(rank)}
          </div>
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={`https://i.pravatar.cc/40?u=${stat.agent.email}`} />
            <AvatarFallback className="text-xs font-semibold">{stat.agent.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm truncate">{stat.agent.name}</span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 capitalize shrink-0">{stat.agent.role}</Badge>
              {!t && <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground shrink-0">No targets set</Badge>}
            </div>
            <p className="text-xs text-muted-foreground truncate">{stat.agent.email}</p>
          </div>

          {/* Score pill */}
          <div className="text-right shrink-0 space-y-1">
            <div className={`text-xl font-bold ${scoreColor(score)}`}>{score}</div>
            <p className="text-[10px] text-muted-foreground">Score</p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {canEdit && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded((e) => !e)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Score bar */}
        <div className="mt-3 flex items-center gap-3">
          <Progress value={score} className={`flex-1 h-2 ${scoreBar(score)}`} />
          <Badge className={`text-[10px] px-2 py-0.5 shrink-0 ${scoreBadge(score)}`}>
            {score >= 90 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Fair" : "Needs Improvement"}
          </Badge>
        </div>

        {/* Quick stats strip */}
        <div className="mt-3 flex gap-4 flex-wrap text-xs text-muted-foreground border-t pt-3">
          <div className="flex items-center gap-1.5">
            <MessageCircle className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">{stat.totalConversations}</span> convos
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            <span className="font-medium text-foreground">{stat.resolutionRate}%</span> resolved
          </div>
          {stat.csatScore !== null && (
            <div className="flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
              <span className="font-medium text-foreground">{stat.csatScore}</span>/5 CSAT
            </div>
          )}
          {stat.avgResponseTimeMins !== null && (
            <div className="flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5 text-blue-500" />
              <span className="font-medium text-foreground">{minsLabel(stat.avgResponseTimeMins)}</span> avg response
            </div>
          )}
        </div>

        {/* Expanded KPI bars */}
        {expanded && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t pt-4">
            <KpiBar label="Conversations" icon={MessageCircle} value={stat.totalConversations} target={t?.conversations ?? null} />
            <KpiBar label="Resolution Rate" icon={CheckCircle2} value={stat.resolutionRate} target={t?.resolutionRate ?? null} unit="%" />
            <KpiBar label="Avg Response Time" icon={Timer} value={stat.avgResponseTimeMins} target={t?.responseTimeMins ?? null} invert format={minsLabel} />
            <KpiBar label="CSAT Score" icon={Star} value={stat.csatScore} target={t?.csatScore ?? null} format={(v) => `${v}/5`} />
            <KpiBar label="Reopen Rate" icon={RotateCcw} value={stat.reopenRate} target={t?.reopenRate ?? null} unit="%" invert />
            <KpiBar label="Avg Handle Time" icon={Hourglass} value={stat.avgHandleTimeMins} target={t?.handleTimeMins ?? null} invert format={minsLabel} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<Period, string> = { daily: "Today", weekly: "This Week", monthly: "This Month" };

const BEST_PRACTICE: Record<Period, Array<{ label: string; icon: React.ElementType; value: string }>> = {
  daily: [
    { label: "Conversations", icon: MessageCircle, value: "≥ 10/day" },
    { label: "First Response", icon: Timer, value: "≤ 5 min" },
    { label: "Resolution Rate", icon: CheckCircle2, value: "≥ 80%" },
    { label: "CSAT Score", icon: Star, value: "≥ 4.2 / 5" },
    { label: "Reopen Rate", icon: RotateCcw, value: "≤ 5%" },
    { label: "Handle Time", icon: Hourglass, value: "≤ 45 min" },
  ],
  weekly: [
    { label: "Conversations", icon: MessageCircle, value: "≥ 50/wk" },
    { label: "First Response", icon: Timer, value: "≤ 5 min" },
    { label: "Resolution Rate", icon: CheckCircle2, value: "≥ 85%" },
    { label: "CSAT Score", icon: Star, value: "≥ 4.2 / 5" },
    { label: "Reopen Rate", icon: RotateCcw, value: "≤ 5%" },
    { label: "Handle Time", icon: Hourglass, value: "≤ 45 min" },
  ],
  monthly: [
    { label: "Conversations", icon: MessageCircle, value: "≥ 200/mo" },
    { label: "First Response", icon: Timer, value: "≤ 5 min" },
    { label: "Resolution Rate", icon: CheckCircle2, value: "≥ 85%" },
    { label: "CSAT Score", icon: Star, value: "≥ 4.2 / 5" },
    { label: "Reopen Rate", icon: RotateCcw, value: "≤ 5%" },
    { label: "Handle Time", icon: Hourglass, value: "≤ 45 min" },
  ],
};

export default function KpiPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { agent: me } = useAuth();
  const isAdmin = me?.role === "admin" || me?.role === "super_admin";

  const [period, setPeriod] = useState<Period>("weekly");
  const [editTarget, setEditTarget] = useState<AgentStat | null>(null);
  const [editPeriod, setEditPeriod] = useState<"weekly" | "monthly">("weekly");
  const [tgtConvs, setTgtConvs] = useState("");
  const [tgtResp, setTgtResp] = useState("");
  const [tgtResolution, setTgtResolution] = useState("");
  const [tgtCsat, setTgtCsat] = useState("");
  const [tgtReopen, setTgtReopen] = useState("");
  const [tgtHandle, setTgtHandle] = useState("");

  const { data, isLoading } = useQuery<{ stats: AgentStat[]; period: string }>({
    queryKey: ["agent-stats", period],
    queryFn: () => apiGet(`/transcripts/agent-stats?period=${period}`),
    refetchInterval: 60000,
  });

  const bestPracticeMutation = useMutation({
    mutationFn: (p: "weekly" | "monthly") => apiPost("/transcripts/kpi-targets/best-practice", { period: p }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-stats"] });
      toast({ title: "Best-practice targets applied to all agents!" });
    },
    onError: () => toast({ title: "Failed to apply defaults", variant: "destructive" }),
  });

  const saveTargetMutation = useMutation({
    mutationFn: ({ agentId, payload }: { agentId: number; payload: Record<string, unknown> }) =>
      apiPut(`/transcripts/kpi-targets/${agentId}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-stats"] });
      setEditTarget(null);
      toast({ title: "KPI targets saved!" });
    },
    onError: () => toast({ title: "Failed to save targets", variant: "destructive" }),
  });

  const openEdit = (stat: AgentStat) => {
    const p = period === "daily" ? "weekly" : period;
    setEditPeriod(p as "weekly" | "monthly");
    setEditTarget(stat);
    setTgtConvs(stat.targets?.conversations != null ? String(stat.targets.conversations) : "");
    setTgtResp(stat.targets?.responseTimeMins != null ? String(stat.targets.responseTimeMins) : "");
    setTgtResolution(stat.targets?.resolutionRate != null ? String(stat.targets.resolutionRate) : "");
    setTgtCsat(stat.targets?.csatScore != null ? String(stat.targets.csatScore) : "");
    setTgtReopen(stat.targets?.reopenRate != null ? String(stat.targets.reopenRate) : "");
    setTgtHandle(stat.targets?.handleTimeMins != null ? String(stat.targets.handleTimeMins) : "");
  };

  const handleSaveTargets = () => {
    if (!editTarget) return;
    const payload: Record<string, unknown> = { period: editPeriod };
    if (tgtConvs) payload.targetConversations = Number(tgtConvs);
    if (tgtResp) payload.targetResponseTimeMins = Number(tgtResp);
    if (tgtResolution) payload.targetResolutionRate = Number(tgtResolution);
    if (tgtCsat) payload.targetCsatScore = Number(tgtCsat);
    if (tgtReopen) payload.targetReopenRate = Number(tgtReopen);
    if (tgtHandle) payload.targetHandleTimeMins = Number(tgtHandle);
    saveTargetMutation.mutate({ agentId: editTarget.agent.id, payload });
  };

  const stats = data?.stats ?? [];
  const ranked = [...stats]
    .map((s) => ({ stat: s, score: computeScore(s) }))
    .sort((a, b) => b.score - a.score);

  function buildKpiSheets() {
    return [
      {
        name: "Agent KPI Leaderboard",
        headers: ["Rank", "Agent", "Score", "Conversations", "Resolution Rate", "CSAT Score", "Avg Response (min)", "Avg Handle (min)"],
        rows: ranked.map((r, i) => [
          i + 1,
          r.stat.agent.name,
          `${r.score}%`,
          r.stat.totalConversations,
          `${r.stat.resolutionRate.toFixed(1)}%`,
          r.stat.csatScore !== null ? r.stat.csatScore.toFixed(2) : "N/A",
          r.stat.avgResponseTime !== null ? r.stat.avgResponseTime.toFixed(1) : "N/A",
          r.stat.avgHandleTime !== null ? r.stat.avgHandleTime.toFixed(1) : "N/A",
        ]),
      },
    ];
  }

  function handleKpiExcelExport() {
    exportToExcel(`kpi-leaderboard-${period}`, buildKpiSheets());
  }

  function handleKpiPdfExport() {
    exportToPdf(`kpi-leaderboard-${period}`, `Agent KPI Leaderboard — ${period.charAt(0).toUpperCase() + period.slice(1)}`, buildKpiSheets());
  }

  const topAgent = ranked[0];
  const teamAvgScore = ranked.length ? Math.round(ranked.reduce((s, r) => s + r.score, 0) / ranked.length) : 0;
  const now = new Date();

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Agent KPI Leaderboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time performance ranking · {format(now, "EEEE, d MMMM yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ExportButton onExcel={handleKpiExcelExport} onPdf={handleKpiPdfExport} loading={isLoading} />
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-400"
              disabled={period === "daily" || bestPracticeMutation.isPending}
              onClick={() => period !== "daily" && bestPracticeMutation.mutate(period as "weekly" | "monthly")}
              title={period === "daily" ? "Best-practice defaults apply to weekly/monthly targets" : undefined}
            >
              {bestPracticeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Apply Best Practices
            </Button>
          )}
        </div>
      </div>

      {/* Period tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${
              period === p
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Summary bar */}
      {!isLoading && ranked.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Active Agents</p>
              <p className="text-2xl font-bold mt-0.5">{ranked.length}</p>
              <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                <Users className="h-3.5 w-3.5" /><span className="text-xs">Tracked {PERIOD_LABELS[period].toLowerCase()}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Team Score</p>
              <p className={`text-2xl font-bold mt-0.5 ${scoreColor(teamAvgScore)}`}>{teamAvgScore}</p>
              <Progress value={teamAvgScore} className={`h-1.5 mt-2 ${scoreBar(teamAvgScore)}`} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Top Performer</p>
              <p className="text-sm font-bold mt-0.5 truncate">{topAgent?.stat.agent.name ?? "—"}</p>
              <p className={`text-lg font-bold ${topAgent ? scoreColor(topAgent.score) : ""}`}>{topAgent?.score ?? "—"} pts</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Total Conversations</p>
              <p className="text-2xl font-bold mt-0.5">
                {ranked.reduce((s, r) => s + r.stat.totalConversations, 0)}
              </p>
              <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                <MessageCircle className="h-3.5 w-3.5" /><span className="text-xs">{PERIOD_LABELS[period].toLowerCase()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Best-practice reference */}
      <div className="rounded-lg border border-violet-200 bg-violet-50/50 dark:border-violet-800/50 dark:bg-violet-950/10 p-3">
        <p className="text-xs font-medium text-violet-700 dark:text-violet-400 mb-2.5 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Industry Best-Practice Benchmarks ({PERIOD_LABELS[period]})
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {BEST_PRACTICE[period].map((b) => (
            <div key={b.label} className="text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                <b.icon className="h-3 w-3" /><span>{b.label}</span>
              </div>
              <p className="text-xs font-semibold text-violet-700 dark:text-violet-400">{b.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : ranked.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Trophy className="h-10 w-10 mx-auto opacity-20 mb-3" />
          <p>No agent data for this period.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ranked.map(({ stat, score }, i) => (
            <AgentKpiCard
              key={stat.agent.id}
              stat={stat}
              rank={i + 1}
              score={score}
              canEdit={isAdmin}
              onEdit={() => openEdit(stat)}
            />
          ))}
        </div>
      )}

      {/* Edit Targets Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set KPI Targets — {editTarget?.agent.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 py-1">
            <div className="mb-3">
              <Label className="text-xs text-muted-foreground mb-1 block">Apply targets to period</Label>
              <Select value={editPeriod} onValueChange={(v) => setEditPeriod(v as "weekly" | "monthly")}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Conversations target", icon: MessageCircle, val: tgtConvs, set: setTgtConvs, placeholder: "e.g. 50" },
                { label: "Avg response (mins)", icon: Timer, val: tgtResp, set: setTgtResp, placeholder: "e.g. 5" },
                { label: "Resolution rate (%)", icon: CheckCircle2, val: tgtResolution, set: setTgtResolution, placeholder: "e.g. 85" },
                { label: "CSAT score (1-5)", icon: Star, val: tgtCsat, set: setTgtCsat, placeholder: "e.g. 4.2" },
                { label: "Reopen rate (%)", icon: RotateCcw, val: tgtReopen, set: setTgtReopen, placeholder: "e.g. 5" },
                { label: "Handle time (mins)", icon: Hourglass, val: tgtHandle, set: setTgtHandle, placeholder: "e.g. 45" },
              ].map(({ label, icon: Icon, val, set, placeholder }) => (
                <div key={label} className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />{label}
                  </Label>
                  <Input
                    type="number"
                    placeholder={placeholder}
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground pt-2">Leave blank to keep existing target. Daily view uses weekly targets.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button size="sm" onClick={handleSaveTargets} disabled={saveTargetMutation.isPending} className="gap-1.5">
              {saveTargetMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Target className="h-3.5 w-3.5" />}
              Save Targets
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
