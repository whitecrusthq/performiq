import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateRangeFilter, DateRange, dateRangeToParams, DEFAULT_DATE_RANGE } from "@/components/date-range-filter";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  Search, Package, AlertTriangle, ShoppingCart, RefreshCw, Loader2,
  TrendingUp, TrendingDown, ChevronUp, ChevronDown, Minus, ArrowUpDown,
} from "lucide-react";
import { SiWhatsapp, SiFacebook, SiInstagram } from "react-icons/si";
import { apiGet } from "@/lib/api";
import { ExportButton } from "@/components/export-button";
import { exportToExcel, exportToPdf } from "@/lib/export-utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface DemandStats {
  totalSearches: number;
  uniqueProductCount: number;
  notAvailableRate: number;
  searchToOrderRate: number;
  searchConversationCount: number;
  notAvailableCount: number;
}

interface ProductTerm {
  term: string;
  display: string;
  count: number;
}

interface TrendPoint {
  date: string;
  label: string;
  searches: number;
  notAvailable: number;
}

interface ProductDemandData {
  period: string;
  stats: DemandStats;
  topSearchedProducts: ProductTerm[];
  trendData: TrendPoint[];
  channelBreakdown: Record<string, number>;
}

// ── Palette ─────────────────────────────────────────────────────────────────

const PRODUCT_COLOURS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#ef4444", "#06b6d4", "#84cc16", "#f97316",
];

const CHANNEL_META: Record<string, { label: string; colour: string; icon: React.ReactNode }> = {
  whatsapp: { label: "WhatsApp", colour: "#25D366", icon: <SiWhatsapp className="h-3.5 w-3.5" /> },
  facebook: { label: "Facebook", colour: "#1877F2", icon: <SiFacebook className="h-3.5 w-3.5" /> },
  instagram: { label: "Instagram", colour: "#E1306C", icon: <SiInstagram className="h-3.5 w-3.5" /> },
};

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  subtitle,
  icon,
  iconBg,
  iconColour,
  formatter = (v: number) => v.toLocaleString(),
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColour: string;
  formatter?: (v: number) => string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight mt-1">{formatter(value)}</p>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ml-3`} style={{ background: iconBg }}>
            <span style={{ color: iconColour }}>{icon}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-card shadow-lg p-3 text-xs space-y-1">
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
        <Search className="h-7 w-7 text-muted-foreground/50" />
      </div>
      <div>
        <p className="text-base font-semibold text-foreground">No Search Data Yet</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          When customers start searching for products through your<br />
          AI assistant, demand intelligence data will appear here.
        </p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProductDemand() {
  const qc = useQueryClient();
  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_DATE_RANGE);

  const { data, isLoading, isFetching } = useQuery<ProductDemandData>({
    queryKey: ["product-demand", dateRange],
    queryFn: () => {
      const p = new URLSearchParams(dateRangeToParams(dateRange));
      return apiGet(`/insights/product-demand?${p.toString()}`);
    },
    staleTime: 60000,
  } as Parameters<typeof useQuery>[0]);

  const hasData = (data?.stats?.totalSearches ?? 0) > 0;

  const refresh = () => qc.invalidateQueries({ queryKey: ["product-demand"] });

  // Filter trend data for chart — condense for large ranges
  const trendData = data?.trendData ?? [];
  const effectiveDays = dateRange.mode === "preset" ? dateRange.days : trendData.length;
  const condensedTrend = effectiveDays > 14
    ? trendData.filter((_, i) => i % Math.ceil(effectiveDays / 14) === 0 || i === trendData.length - 1)
    : trendData;

  const topProducts = data?.topSearchedProducts ?? [];
  const maxCount = Math.max(...topProducts.map((p) => p.count), 1);

  const channelBreakdown = Object.entries(data?.channelBreakdown ?? {});

  // ── Table sort state ────────────────────────────────────────────────────────
  type SortCol = "rank" | "product" | "searches" | "share";
  const [sortCol, setSortCol] = useState<SortCol>("rank");
  const [sortAsc, setSortAsc] = useState(true);

  const totalSearches = data?.stats.totalSearches ?? 0;

  const sortedProducts = [...topProducts].sort((a, b) => {
    let diff = 0;
    if (sortCol === "rank" || sortCol === "searches") diff = b.count - a.count;
    else if (sortCol === "product") diff = a.display.localeCompare(b.display);
    else if (sortCol === "share") diff = b.count - a.count;
    return sortAsc ? diff : -diff;
  });

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortAsc((v) => !v);
    else { setSortCol(col); setSortAsc(true); }
  }

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
    return sortAsc ? <ChevronUp className="h-3.5 w-3.5 text-primary" /> : <ChevronDown className="h-3.5 w-3.5 text-primary" />;
  }

  // ── Export helpers ──────────────────────────────────────────────────────────
  function buildDemandSheets() {
    return [
      {
        name: "Top Products",
        headers: ["Rank", "Product Name", "Searches", "Share (%)"],
        rows: topProducts.map((p, i) => [
          i + 1, p.display, p.count,
          totalSearches > 0 ? `${((p.count / totalSearches) * 100).toFixed(1)}%` : "0%",
        ]),
      },
      {
        name: "Channel Breakdown",
        headers: ["Channel", "Searches"],
        rows: channelBreakdown.map(([ch, cnt]) => [ch.toUpperCase(), cnt]),
      },
      {
        name: "Summary",
        headers: ["Metric", "Value"],
        rows: [
          ["Total Searches", data?.stats.totalSearches ?? 0],
          ["Unique Products", data?.stats.uniqueProductCount ?? 0],
          ["Not Available Rate", `${(data?.stats.notAvailableRate ?? 0).toFixed(1)}%`],
          ["Search-to-Order Rate", `${(data?.stats.searchToOrderRate ?? 0).toFixed(1)}%`],
        ],
      },
    ];
  }

  function handleDemandExcel() { exportToExcel("product-demand", buildDemandSheets()); }
  function handleDemandPdf() { exportToPdf("product-demand", "Product Demand Intelligence Report", buildDemandSheets()); }
  const totalChannelSearches = channelBreakdown.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center shrink-0 mt-0.5">
            <Search className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Product Demand Intelligence</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              AI-powered insights into what your customers are looking for
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <Button variant="outline" size="sm" onClick={refresh} disabled={isFetching} className="gap-1.5">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <ExportButton onExcel={handleDemandExcel} onPdf={handleDemandPdf} loading={isLoading} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Product Searches"
              value={data?.stats.totalSearches ?? 0}
              subtitle="Across all customer conversations"
              icon={<Search className="h-5 w-5" />}
              iconBg="rgba(99,102,241,0.12)"
              iconColour="#6366f1"
            />
            <StatCard
              title="Unique Products in Demand"
              value={data?.stats.uniqueProductCount ?? 0}
              subtitle="Distinct products searched for"
              icon={<Package className="h-5 w-5" />}
              iconBg="rgba(139,92,246,0.12)"
              iconColour="#8b5cf6"
            />
            <StatCard
              title="Not Available Rate"
              value={data?.stats.notAvailableRate ?? 0}
              subtitle={`${data?.stats.notAvailableCount ?? 0} searches hit unavailable products`}
              icon={<AlertTriangle className="h-5 w-5" />}
              iconBg="rgba(245,158,11,0.12)"
              iconColour="#f59e0b"
              formatter={(v) => `${v}%`}
            />
            <StatCard
              title="Search-to-Order Rate"
              value={data?.stats.searchToOrderRate ?? 0}
              subtitle={`${data?.stats.searchConversationCount ?? 0} sessions converted to orders`}
              icon={<ShoppingCart className="h-5 w-5" />}
              iconBg="rgba(16,185,129,0.12)"
              iconColour="#10b981"
              formatter={(v) => `${v}%`}
            />
          </div>

          {!hasData ? (
            <EmptyState />
          ) : (
            <>
              {/* ── Trend charts ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Search Volume Trend</CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {data?.stats.totalSearches} total
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {condensedTrend.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-10">No data available</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={condensedTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="gradSearch" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <Area
                            type="monotone"
                            dataKey="searches"
                            name="Searches"
                            stroke="#6366f1"
                            strokeWidth={2}
                            fill="url(#gradSearch)"
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Not Available Trend</CardTitle>
                      <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400">
                        {data?.stats.notAvailableRate ?? 0}% rate
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {condensedTrend.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-10">No data available</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={condensedTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="gradNA" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <Area
                            type="monotone"
                            dataKey="notAvailable"
                            name="Not Available"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            fill="url(#gradNA)"
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* ── Top searched products + channel breakdown ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Top products — takes 2/3 width */}
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Top Products in Demand
                      </CardTitle>
                      <span className="text-xs text-muted-foreground">{dateRange.mode === "preset" ? `Last ${dateRange.days} days` : "Custom range"}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    {topProducts.slice(0, 12).map((product, i) => (
                      <div key={product.term} className="flex items-center gap-3">
                        <span className="text-xs font-mono text-muted-foreground w-5 text-right shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-sm font-medium truncate">{product.display}</span>
                            <span className="text-xs font-semibold shrink-0" style={{ color: PRODUCT_COLOURS[i % PRODUCT_COLOURS.length] }}>
                              {product.count} {product.count === 1 ? "search" : "searches"}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${(product.count / maxCount) * 100}%`,
                                background: PRODUCT_COLOURS[i % PRODUCT_COLOURS.length],
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    {topProducts.length === 0 && (
                      <p className="text-center text-sm text-muted-foreground py-6">No product searches detected yet</p>
                    )}
                  </CardContent>
                </Card>

                {/* Channel breakdown — takes 1/3 */}
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Searches by Channel</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {channelBreakdown.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No data</p>
                      ) : (
                        channelBreakdown.sort(([, a], [, b]) => b - a).map(([ch, count]) => {
                          const meta = CHANNEL_META[ch] ?? { label: ch, colour: "#6366f1", icon: null };
                          const pct = totalChannelSearches > 0 ? Math.round((count / totalChannelSearches) * 100) : 0;
                          return (
                            <div key={ch} className="space-y-1.5">
                              <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-1.5" style={{ color: meta.colour }}>
                                  {meta.icon}
                                  <span className="text-foreground text-xs font-medium">{meta.label}</span>
                                </div>
                                <span className="text-xs font-semibold">{count} <span className="text-muted-foreground font-normal">({pct}%)</span></span>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.colour }} />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>

                  {/* Demand health card */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Demand Health</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        {
                          label: "Stock Coverage",
                          value: 100 - (data?.stats.notAvailableRate ?? 0),
                          colour: (100 - (data?.stats.notAvailableRate ?? 0)) >= 80 ? "#10b981" : "#f59e0b",
                          suffix: "%",
                        },
                        {
                          label: "Conversion Rate",
                          value: data?.stats.searchToOrderRate ?? 0,
                          colour: (data?.stats.searchToOrderRate ?? 0) >= 50 ? "#10b981" : "#6366f1",
                          suffix: "%",
                        },
                      ].map((item) => (
                        <div key={item.label} className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="font-semibold" style={{ color: item.colour }}>{item.value}{item.suffix}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${Math.min(item.value, 100)}%`, background: item.colour }}
                            />
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* ── Bar chart: product search frequency ── */}
              {topProducts.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Product Search Frequency</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={topProducts.slice(0, 10).map((p, i) => ({
                          name: p.display.length > 15 ? p.display.slice(0, 13) + "…" : p.display,
                          count: p.count,
                          fill: PRODUCT_COLOURS[i % PRODUCT_COLOURS.length],
                        }))}
                        margin={{ top: 5, right: 10, left: -20, bottom: 30 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} angle={-25} textAnchor="end" />
                        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="count" name="Searches" radius={[4, 4, 0, 0]}>
                          {topProducts.slice(0, 10).map((_, i) => (
                            <Cell key={i} fill={PRODUCT_COLOURS[i % PRODUCT_COLOURS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* ── Frequently Requested Products — sortable table ── */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        Frequently Requested Products
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        All products asked about by customers — click column headers to sort
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">{topProducts.length} products</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {topProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                      <Package className="h-8 w-8 opacity-30" />
                      <p className="text-sm">No product requests detected yet</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/40">
                            {([
                              { key: "rank", label: "#", cls: "w-12 text-center" },
                              { key: "product", label: "Product Name", cls: "text-left" },
                              { key: "searches", label: "Searches", cls: "text-right" },
                              { key: "share", label: "Share", cls: "text-right" },
                            ] as { key: SortCol; label: string; cls: string }[]).map((col) => (
                              <th
                                key={col.key}
                                className={`px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none ${col.cls}`}
                                onClick={() => toggleSort(col.key)}
                              >
                                <span className="inline-flex items-center gap-1">
                                  {col.label}
                                  <SortIcon col={col.key} />
                                </span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sortedProducts.map((product, i) => {
                            const originalRank = topProducts.findIndex((p) => p.term === product.term) + 1;
                            const share = totalSearches > 0 ? ((product.count / totalSearches) * 100).toFixed(1) : "0.0";
                            const colour = PRODUCT_COLOURS[(originalRank - 1) % PRODUCT_COLOURS.length];
                            return (
                              <tr key={product.term} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-3 text-center">
                                  <span className="text-xs font-mono text-muted-foreground">{originalRank}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full shrink-0" style={{ background: colour }} />
                                    <span className="font-medium">{product.display}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className="font-semibold" style={{ color: colour }}>{product.count.toLocaleString()}</span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="inline-flex items-center gap-2">
                                    <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden hidden sm:block">
                                      <div
                                        className="h-full rounded-full"
                                        style={{ width: `${share}%`, background: colour }}
                                      />
                                    </div>
                                    <span className="text-xs text-muted-foreground w-10 text-right">{share}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
