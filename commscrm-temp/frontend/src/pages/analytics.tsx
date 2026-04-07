import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateRangeFilter, DateRange, dateRangeToParams, DEFAULT_DATE_RANGE } from "@/components/date-range-filter";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  MessageSquare, Send, Bot, Loader2, RefreshCw,
  Instagram, Facebook,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { ExportButton } from "@/components/export-button";
import { exportToExcel, exportToPdf } from "@/lib/export-utils";

interface AnalyticsSummary {
  totalReceived: number;
  totalSent: number;
  aiMessages: number;
  aiPercentage: number;
  topChannel: string;
  topChannelCount: number;
}

interface ChannelStat {
  channel: "whatsapp" | "facebook" | "instagram";
  received: number;
  sent: number;
  aiMessages: number;
}

interface AnalyticsData {
  summary: AnalyticsSummary;
  dailyTrend: Array<{ date: string; received: number; sent: number }>;
  channelStats: ChannelStat[];
  days: number;
}

const CHANNEL_CONFIG = {
  whatsapp: {
    label: "WhatsApp",
    bg: "bg-green-50 dark:bg-green-950/30",
    border: "border-green-100 dark:border-green-900",
    accent: "text-green-600 dark:text-green-400",
    badge: "bg-green-500",
    Icon: () => (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.557 4.123 1.529 5.855L.057 23.885a.5.5 0 0 0 .611.612l6.101-1.524A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.877 0-3.659-.506-5.191-1.393l-.371-.218-3.844.96.96-3.787-.231-.382A10 10 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
      </svg>
    ),
  },
  instagram: {
    label: "Instagram",
    bg: "bg-pink-50 dark:bg-pink-950/30",
    border: "border-pink-100 dark:border-pink-900",
    accent: "text-pink-600 dark:text-pink-400",
    badge: "bg-pink-500",
    Icon: Instagram,
  },
  facebook: {
    label: "Facebook",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-100 dark:border-blue-900",
    accent: "text-blue-600 dark:text-blue-400",
    badge: "bg-blue-500",
    Icon: Facebook,
  },
} as const;

function channelLabel(ch: string): string {
  return CHANNEL_CONFIG[ch as keyof typeof CHANNEL_CONFIG]?.label ?? ch.charAt(0).toUpperCase() + ch.slice(1);
}

function TrendStats({ data, key: _key }: { data: Array<{ date: string; received: number; sent: number }>; key?: string }) {
  if (!data.length) return <div className="flex gap-8 pt-3 border-t"><StatPill label="Latest" value={0} /><StatPill label="Peak" value={0} /><StatPill label="Avg" value={0} /></div>;
  return null;
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function TrendCard({
  title,
  dataKey,
  color,
  data,
}: {
  title: string;
  dataKey: "received" | "sent";
  color: string;
  data: Array<{ date: string; received: number; sent: number }>;
}) {
  const values = data.map((d) => d[dataKey]);
  const latest = values[values.length - 1] ?? 0;
  const peak = values.length ? Math.max(...values) : 0;
  const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;

  const ticks: string[] = [];
  if (data.length > 0) {
    ticks.push(data[0].date);
    if (data.length > 1) ticks.push(data[Math.floor(data.length / 2)].date);
    ticks.push(data[data.length - 1].date);
  }

  return (
    <Card className="flex-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                interval="preserveStartEnd"
                ticks={ticks}
                dy={8}
              />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                formatter={(v: number) => [v, dataKey === "received" ? "Received" : "Sent"]}
              />
              <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-8 pt-4 mt-2 border-t">
          <StatPill label="Latest" value={latest} />
          <StatPill label="Peak" value={peak} />
          <StatPill label="Avg" value={avg} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Analytics() {
  const qc = useQueryClient();
  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_DATE_RANGE);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading, isFetching } = useQuery<AnalyticsData>({
    queryKey: ["analytics-messages", dateRange, refreshKey],
    queryFn: () => {
      const p = new URLSearchParams(dateRangeToParams(dateRange));
      return apiGet(`/analytics?${p.toString()}`);
    },
    staleTime: 60000,
  });

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    qc.invalidateQueries({ queryKey: ["analytics-messages"] });
  };

  const summary = data?.summary;
  const trend = data?.dailyTrend ?? [];
  const channels = data?.channelStats ?? [];

  function buildExportSheets() {
    return [
      {
        name: "Summary",
        headers: ["Metric", "Value"],
        rows: [
          ["Total Messages Received", summary?.totalReceived ?? 0],
          ["Total Messages Sent", summary?.totalSent ?? 0],
          ["AI-Generated Messages", summary?.aiMessages ?? 0],
          ["AI Percentage", `${(summary?.aiPercentage ?? 0).toFixed(1)}%`],
          ["Top Channel", summary?.topChannel ?? ""],
          ["Top Channel Messages", summary?.topChannelCount ?? 0],
        ] as (string | number | null)[][],
      },
      {
        name: "Channel Breakdown",
        headers: ["Channel", "Received", "Sent", "AI Messages"],
        rows: channels.map((c) => [c.channel.toUpperCase(), c.received, c.sent, c.aiMessages]),
      },
      {
        name: "Daily Trend",
        headers: ["Date", "Received", "Sent"],
        rows: trend.map((t) => [t.date, t.received, t.sent]),
      },
    ];
  }

  function handleExcelExport() {
    exportToExcel("messages-analytics", buildExportSheets());
  }

  function handlePdfExport() {
    exportToPdf("messages-analytics", "Messages Analytics Report", buildExportSheets());
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            Messages Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Detailed insights into your message performance and engagement</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2 h-9" data-testid="button-refresh-analytics">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <ExportButton onExcel={handleExcelExport} onPdf={handlePdfExport} loading={isLoading} />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Messages Received</p>
                <p className="text-3xl font-bold mt-1">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mt-1" /> : (summary?.totalReceived ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center shrink-0">
                <MessageSquare className="h-6 w-6 text-sky-600 dark:text-sky-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Messages Sent</p>
                <p className="text-3xl font-bold mt-1">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mt-1" /> : (summary?.totalSent ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <Send className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">AI Messages</p>
                <p className="text-3xl font-bold mt-1">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mt-1" /> : (summary?.aiMessages ?? 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{summary?.aiPercentage ?? 0}% of total sent</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                <Bot className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Top Platform</p>
                <p className="text-2xl font-bold mt-1 capitalize">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mt-1" /> : channelLabel(summary?.topChannel ?? "whatsapp")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{(summary?.topChannelCount ?? 0).toLocaleString()} conversations</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                <MessageSquare className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend Charts */}
      {isLoading ? (
        <div className="flex gap-4">
          {[0, 1].map((i) => (
            <Card key={i} className="flex-1">
              <CardContent className="pt-6 flex justify-center items-center h-[280px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex gap-4">
          <TrendCard title="Messages Received Trend" dataKey="received" color="#0ea5e9" data={trend} />
          <TrendCard title="Messages Sent Trend" dataKey="sent" color="#10b981" data={trend} />
        </div>
      )}

      {/* Platform Performance */}
      <div>
        <h2 className="text-base font-semibold mb-4">Platform Performance</h2>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6 flex justify-center items-center h-[140px]">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["whatsapp", "facebook", "instagram"] as const).map((channelKey) => {
              const cfg = CHANNEL_CONFIG[channelKey];
              const stat = channels.find((c) => c.channel === channelKey) ?? { channel: channelKey, received: 0, sent: 0, aiMessages: 0 };
              const total = stat.received + stat.sent;
              return (
                <Card key={channelKey} className={`${cfg.bg} ${cfg.border} border`}>
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <cfg.Icon className={`h-5 w-5 ${cfg.accent}`} />
                        <span className="font-semibold text-sm">{cfg.label}</span>
                      </div>
                      <span className={`text-2xl font-bold ${cfg.accent}`}>{total.toLocaleString()}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Messages received</span>
                        <span className={`font-medium ${cfg.accent}`}>{stat.received.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Messages sent</span>
                        <span className={`font-medium ${cfg.accent}`}>{stat.sent.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">AI messages</span>
                        <span className={`font-medium ${cfg.accent}`}>{stat.aiMessages.toLocaleString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
