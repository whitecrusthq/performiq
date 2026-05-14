import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { PageHeader } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch as apiFetchBase } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import {
  BarChart3, ArrowRight, MessageSquareWarning, CircleDot, Clock, CheckCircle2,
  XCircle, AlertTriangle, Timer, TrendingUp, Users, Target, Flame,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

async function fetchJson(url: string) {
  const r = await apiFetchBase(url);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Failed");
  return r.json();
}

const CAT_LABELS: Record<string, string> = {
  general: "General", payroll: "Payroll", benefits: "Benefits", policy: "Policy",
  leave: "Leave", contract: "Contract", conduct: "Conduct", other: "Other",
};
const PIE_COLORS = ["#3b82f6", "#f59e0b", "#22c55e", "#94a3b8"];

function formatHours(h: number | null | undefined): string {
  if (h === null || h === undefined) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 24) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} days`;
}

function StatCard({
  label, value, sub, icon: Icon, tone = "default",
}: {
  label: string; value: React.ReactNode; sub?: React.ReactNode;
  icon: any; tone?: "default" | "blue" | "amber" | "green" | "red" | "violet";
}) {
  const tones: Record<string, string> = {
    default: "bg-card",
    blue: "bg-blue-50 dark:bg-blue-950/30",
    amber: "bg-amber-50 dark:bg-amber-950/30",
    green: "bg-green-50 dark:bg-green-950/30",
    red: "bg-red-50 dark:bg-red-950/30",
    violet: "bg-violet-50 dark:bg-violet-950/30",
  };
  const iconTone: Record<string, string> = {
    default: "text-muted-foreground",
    blue: "text-blue-600 dark:text-blue-400",
    amber: "text-amber-600 dark:text-amber-400",
    green: "text-green-600 dark:text-green-400",
    red: "text-red-600 dark:text-red-400",
    violet: "text-violet-600 dark:text-violet-400",
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold mt-1">{value}</div>
          {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
        </div>
        <Icon className={`w-5 h-5 ${iconTone[tone]}`} />
      </div>
    </div>
  );
}

export default function HrSupportDashboard() {
  const { user } = useAuth();
  const isHR = !!user && (
    ["super_admin", "admin"].includes((user as any).role) ||
    ((user as any).customRoleName || "").toLowerCase() === "hr manager"
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["hr-queries-metrics"],
    queryFn: () => fetchJson("/api/hr-queries/metrics"),
    refetchInterval: 60_000,
    enabled: isHR,
  });

  if (!isHR) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-2">
        <BarChart3 className="w-10 h-10 text-muted-foreground/40" />
        <h2 className="text-lg font-semibold">Not available</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          The HR Support Dashboard is only visible to HR officers and administrators.
        </p>
        <Link href="/hr-queries">
          <a className="text-sm text-primary hover:underline mt-2">Back to HR Support</a>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading dashboard…</div>;
  }
  if (error) {
    return <div className="p-6 text-sm text-red-600">Failed to load metrics: {(error as Error).message}</div>;
  }
  const t = data.totals;
  const slaPct = data.slaCompliance == null ? null : Math.round(data.slaCompliance * 100);

  const statusPie = [
    { name: "Open", value: t.open, color: "#3b82f6" },
    { name: "In Progress", value: t.in_progress, color: "#f59e0b" },
    { name: "Resolved", value: t.resolved, color: "#22c55e" },
    { name: "Closed", value: t.closed, color: "#94a3b8" },
  ].filter(s => s.value > 0);

  const categoryData = data.byCategory.map((c: any) => ({
    category: CAT_LABELS[c.category] ?? c.category,
    count: c.count,
  }));

  const assigneeData = data.byAssignee.slice(0, 8).map((a: any) => ({
    name: a.name,
    open: a.open,
    total: a.total,
    avgResp: a.avgResponseHours,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="HR Support Dashboard"
        description="Real-time metrics for HR ticket volume, response time, SLA compliance and team workload."
        action={
          <Link href="/hr-queries">
            <a>
              <Button variant="outline" className="gap-1.5">
                <MessageSquareWarning className="w-4 h-4" /> Go to tickets <ArrowRight className="w-3 h-3" />
              </Button>
            </a>
          </Link>
        }
      />

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Open tickets" value={t.open} icon={CircleDot} tone="blue"
          sub={`${t.in_progress} in progress`} />
        <StatCard label="Avg. first response" value={formatHours(data.avgResponseHours)} icon={Timer} tone="amber"
          sub="last 30 days" />
        <StatCard label="Avg. resolution time" value={formatHours(data.avgResolutionHours)} icon={CheckCircle2} tone="green"
          sub="last 30 days" />
        <StatCard
          label="SLA compliance"
          value={slaPct == null ? "—" : `${slaPct}%`}
          icon={Target}
          tone={slaPct == null ? "default" : slaPct >= 80 ? "green" : slaPct >= 50 ? "amber" : "red"}
          sub={data.slaWindow?.sampleSize ? `${data.slaWindow.met}/${data.slaWindow.sampleSize} on time` : "no responses yet"}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Created today" value={t.createdToday} icon={TrendingUp} />
        <StatCard label="Created this week" value={t.createdWeek} icon={BarChart3} />
        <StatCard label="Escalated (all-time)" value={t.escalated} icon={Flame} tone={t.escalated > 0 ? "red" : "default"} />
        <StatCard label="Total tickets" value={t.all} icon={MessageSquareWarning} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Trend */}
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Ticket volume (last 14 days)</h3>
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={data.trend} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="day"
                  tickFormatter={(d: string) => d.slice(5)}
                  className="text-xs"
                />
                <YAxis allowDecimals={false} className="text-xs" />
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(d: string) => new Date(d).toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" })}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="created" stroke="#3b82f6" strokeWidth={2} name="Created" dot={false} />
                <Line type="monotone" dataKey="resolved" stroke="#22c55e" strokeWidth={2} name="Resolved" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status pie */}
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Tickets by status</h3>
            <CircleDot className="w-4 h-4 text-muted-foreground" />
          </div>
          {statusPie.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">No tickets yet</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={statusPie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {statusPie.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Categories */}
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Tickets by category</h3>
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </div>
          {categoryData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">No tickets yet</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={categoryData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="category" className="text-xs" />
                  <YAxis allowDecimals={false} className="text-xs" />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Open by priority */}
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Open queue by priority</h3>
            <AlertTriangle className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="space-y-3 mt-2">
            {data.openByPriority.map((p: any) => {
              const max = Math.max(1, ...data.openByPriority.map((x: any) => x.count));
              const pct = (p.count / max) * 100;
              const color = p.priority === "high" ? "bg-red-500" : p.priority === "normal" ? "bg-slate-400" : "bg-gray-300";
              const label = p.priority === "high" ? "High" : p.priority === "normal" ? "Normal" : "Low";
              return (
                <div key={p.priority}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{label}</span>
                    <span className="text-muted-foreground">{p.count} open / in-progress</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="text-[11px] text-muted-foreground mt-3 pt-3 border-t">
              SLA targets for first response: High = 4 h · Normal = 24 h · Low = 72 h
            </div>
          </div>
        </div>
      </div>

      {/* Assignee workload */}
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Workload by HR officer</h3>
          <Users className="w-4 h-4 text-muted-foreground" />
        </div>
        {assigneeData.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">No tickets assigned yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-2 pr-3">Officer</th>
                  <th className="py-2 pr-3 text-right">Open / In-progress</th>
                  <th className="py-2 pr-3 text-right">Total assigned</th>
                  <th className="py-2 text-right">Avg. response (30 d)</th>
                </tr>
              </thead>
              <tbody>
                {assigneeData.map((a: any, i: number) => (
                  <tr key={i} className="border-b last:border-b-0">
                    <td className="py-2 pr-3 font-medium">{a.name}</td>
                    <td className="py-2 pr-3 text-right">
                      <Badge variant={a.open > 0 ? "default" : "outline"}>{a.open}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-right text-muted-foreground">{a.total}</td>
                    <td className="py-2 text-right text-muted-foreground">{formatHours(a.avgResp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
