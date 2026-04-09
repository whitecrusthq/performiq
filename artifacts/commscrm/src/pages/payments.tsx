import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBranding } from "@/lib/branding-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  DollarSign, TrendingUp, CheckCircle2, XCircle, Clock, RefreshCw,
  Search, Filter, Download, Plus, Copy, ExternalLink, Trash2,
  CreditCard, Link2, BarChart2, LayoutDashboard, ChevronDown,
  ArrowUpRight, ArrowDownRight, Percent, ShoppingCart, Loader2,
  AlertCircle, Check,
} from "lucide-react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────
type TxStatus   = "success" | "failed" | "pending" | "refunded";
type TxProvider = "stripe" | "paystack" | "flutterwave" | "paypal" | "square";
type LinkStatus = "active" | "paid" | "expired" | "cancelled";

interface Transaction {
  id: number;
  provider: TxProvider;
  txRef: string;
  amount: number;
  currency: string;
  status: TxStatus;
  customerName: string;
  customerEmail: string;
  description: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface PaymentLink {
  id: number;
  provider: TxProvider;
  title: string;
  description: string | null;
  amount: number;
  currency: string;
  status: LinkStatus;
  linkToken: string;
  linkUrl: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  customerName: string | null;
  customerEmail: string | null;
  createdBy: string;
  createdAt: string;
}

interface PaymentStats {
  summary: {
    totalRevenue: number;
    totalTx: number;
    successTx: number;
    failedTx: number;
    pendingTx: number;
    refundedTx: number;
    successRate: number;
    avgOrderValue: number;
  };
  byProvider: Array<{ provider: string; total: number; success: number; revenue: number }>;
  trend: Array<{ date: string; revenue: number; count: number }>;
  days: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────
type Tab = "dashboard" | "transactions" | "analytics" | "links";

const PROVIDERS: Record<TxProvider, { label: string; color: string; bg: string; dot: string }> = {
  stripe:      { label: "Stripe",      color: "text-violet-700 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-900/20", dot: "#7c3aed" },
  paystack:    { label: "Paystack",    color: "text-blue-700 dark:text-blue-400",     bg: "bg-blue-50 dark:bg-blue-900/20",     dot: "#2563eb" },
  flutterwave: { label: "Flutterwave", color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/20", dot: "#ea580c" },
  paypal:      { label: "PayPal",      color: "text-sky-700 dark:text-sky-400",       bg: "bg-sky-50 dark:bg-sky-900/20",       dot: "#0284c7" },
  square:      { label: "Square",      color: "text-emerald-700 dark:text-emerald-400",bg:"bg-emerald-50 dark:bg-emerald-900/20",dot:"#059669" },
};

const STATUS_CONFIG: Record<TxStatus | LinkStatus, { label: string; variant: "default"|"secondary"|"destructive"|"outline"; className: string }> = {
  success:   { label: "Success",   variant: "default",    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0" },
  failed:    { label: "Failed",    variant: "destructive", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-0" },
  pending:   { label: "Pending",   variant: "secondary",  className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-0" },
  refunded:  { label: "Refunded",  variant: "outline",    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-0" },
  active:    { label: "Active",    variant: "default",    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-0" },
  paid:      { label: "Paid",      variant: "default",    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0" },
  expired:   { label: "Expired",   variant: "outline",    className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-0" },
  cancelled: { label: "Cancelled", variant: "destructive",className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0" },
};

const PIE_COLORS = ["#7c3aed", "#2563eb", "#ea580c", "#0284c7", "#059669"];
const DAYS_OPTIONS = [7, 14, 30, 60, 90];

function fmtCurrency(amount: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

let _globalCurrency = "USD";
function setGlobalCurrency(c: string) { _globalCurrency = c; }
function fmtDefault(amount: number) { return fmtCurrency(amount, _globalCurrency); }

// ── Sub-components ────────────────────────────────────────────────────────────
function KpiCard({ title, value, sub, icon: Icon, trend, trendPositive, color }: {
  title: string; value: string; sub?: string;
  icon: React.ElementType; trend?: string; trendPositive?: boolean;
  color: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold tracking-tight truncate">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
            {trend && (
              <div className={`flex items-center gap-1 text-xs font-medium ${trendPositive ? "text-green-600" : "text-red-500"}`}>
                {trendPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {trend}
              </div>
            )}
          </div>
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProviderBadge({ provider }: { provider: TxProvider }) {
  const cfg = PROVIDERS[provider] ?? { label: provider, color: "text-muted-foreground", bg: "bg-muted" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color} ${cfg.bg}`}>
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: TxStatus | LinkStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: "bg-muted text-muted-foreground border-0" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>{cfg.label}</span>;
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────
function DashboardTab({ days, setDays }: { days: number; setDays: (d: number) => void }) {
  const { data: stats, isLoading } = useQuery<PaymentStats>({
    queryKey: ["payment-stats", days],
    queryFn: () => apiGet(`/api/payments/stats?days=${days}`),
  });

  const { data: txData } = useQuery<{ transactions: Transaction[] }>({
    queryKey: ["payment-transactions-recent"],
    queryFn: () => apiGet("/api/payments/transactions?limit=5"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const s = stats?.summary;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Revenue"
          value={s ? fmtDefault(s.totalRevenue) : "—"}
          sub={`Last ${days} days`}
          icon={DollarSign}
          color="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
          trend={s ? `${s.totalTx} transactions` : undefined}
          trendPositive
        />
        <KpiCard
          title="Success Rate"
          value={s ? `${s.successRate}%` : "—"}
          sub={`${s?.successTx ?? 0} successful`}
          icon={Percent}
          color="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
          trend={s && s.successRate >= 80 ? "Above target" : "Below target"}
          trendPositive={s ? s.successRate >= 80 : false}
        />
        <KpiCard
          title="Avg Order Value"
          value={s ? fmtDefault(s.avgOrderValue) : "—"}
          sub="Per successful transaction"
          icon={TrendingUp}
          color="bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400"
        />
        <KpiCard
          title="Failed Transactions"
          value={s ? `${s.failedTx}` : "—"}
          sub={`${s?.pendingTx ?? 0} pending, ${s?.refundedTx ?? 0} refunded`}
          icon={XCircle}
          color="bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400"
          trend={s && s.failedTx > 5 ? "Needs attention" : undefined}
          trendPositive={false}
        />
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base font-semibold">Revenue Trend</CardTitle>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS_OPTIONS.map((d) => (
                <SelectItem key={d} value={String(d)}>{d} days</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={stats?.trend ?? []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }}
                tickFormatter={(v) => format(parseISO(v), "MMM d")} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} width={55} />
              <Tooltip
                formatter={(v: number) => [fmtDefault(v), "Revenue"]}
                labelFormatter={(l) => format(parseISO(l as string), "MMM d, yyyy")}
              />
              <Area type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={2}
                fill="url(#revenueGrad)" dot={false} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Provider breakdown + Recent transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Provider breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Revenue by Provider</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.byProvider.length ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={stats.byProvider}
                      dataKey="revenue"
                      nameKey="provider"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={40}
                    >
                      {stats.byProvider.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtDefault(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {stats.byProvider.map((p, i) => (
                    <div key={p.provider} className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="font-medium capitalize">{p.provider}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-xs">{p.total} tx</span>
                        <span className="font-semibold">{fmtDefault(p.revenue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm">
                <BarChart2 className="h-8 w-8 mb-2 opacity-30" />
                No provider data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent transactions */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {(txData?.transactions ?? []).slice(0, 5).map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                    {tx.customerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tx.customerName}</p>
                    <p className="text-xs text-muted-foreground truncate">{tx.txRef}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{fmtCurrency(tx.amount, tx.currency)}</p>
                    <StatusBadge status={tx.status} />
                  </div>
                </div>
              ))}
              {!txData?.transactions.length && (
                <div className="py-10 text-center text-sm text-muted-foreground">No transactions yet</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Successful", count: s?.successTx ?? 0,  icon: CheckCircle2, cls: "text-green-600 bg-green-50 dark:bg-green-900/20" },
          { label: "Failed",     count: s?.failedTx ?? 0,   icon: XCircle,      cls: "text-red-500 bg-red-50 dark:bg-red-900/20" },
          { label: "Pending",    count: s?.pendingTx ?? 0,  icon: Clock,        cls: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20" },
          { label: "Refunded",   count: s?.refundedTx ?? 0, icon: RefreshCw,    cls: "text-slate-600 bg-slate-100 dark:bg-slate-800" },
        ].map(({ label, count, icon: Icon, cls }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${cls}`}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-lg font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Transactions Tab ──────────────────────────────────────────────────────────
function TransactionsTab() {
  const [search,   setSearch]   = useState("");
  const [provider, setProvider] = useState("all");
  const [status,   setStatus]   = useState("all");
  const [days,     setDays]     = useState("30");
  const [page,     setPage]     = useState(1);
  const [copied,   setCopied]   = useState<string | null>(null);

  const params = new URLSearchParams({
    search, provider, status,
    days, page: String(page), limit: "20",
  });

  const { data, isLoading } = useQuery<{ transactions: Transaction[]; total: number }>({
    queryKey: ["payment-transactions", search, provider, status, days, page],
    queryFn:  () => apiGet(`/api/payments/transactions?${params}`),
    keepPreviousData: true,
  } as Parameters<typeof useQuery>[0]);

  function copyRef(ref: string) {
    navigator.clipboard.writeText(ref).catch(() => {});
    setCopied(ref);
    setTimeout(() => setCopied(null), 1500);
  }

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9 h-9" placeholder="Search name, email, reference…" value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <Select value={provider} onValueChange={(v) => { setProvider(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-36">
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                {Object.entries(PROVIDERS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
            <Select value={days} onValueChange={(v) => { setDays(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OPTIONS.map((d) => <SelectItem key={d} value={String(d)}>{d} days</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground ml-auto">{data?.total ?? 0} results</span>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.transactions ?? []).map((tx, i) => (
                    <TableRow key={tx.id} className="hover:bg-muted/30">
                      <TableCell className="text-xs text-muted-foreground">{(page - 1) * 20 + i + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{tx.txRef}</code>
                          <button onClick={() => copyRef(tx.txRef)} className="text-muted-foreground hover:text-foreground transition-colors">
                            {copied === tx.txRef ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{tx.customerName}</p>
                          <p className="text-xs text-muted-foreground">{tx.customerEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell><ProviderBadge provider={tx.provider} /></TableCell>
                      <TableCell className="text-right font-semibold text-sm">
                        {fmtCurrency(tx.amount, tx.currency)}
                      </TableCell>
                      <TableCell><StatusBadge status={tx.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(parseISO(tx.createdAt), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        {tx.description && (
                          <span title={tx.description}>
                            <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!data?.transactions.length && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        No transactions match your filters
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} · {data?.total} total
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Analytics Tab ─────────────────────────────────────────────────────────────
function AnalyticsTab() {
  const [days, setDays] = useState(30);
  const { data: stats, isLoading } = useQuery<PaymentStats>({
    queryKey: ["payment-stats", days],
    queryFn: () => apiGet(`/api/payments/stats?days=${days}`),
  });

  const successRateData = useMemo(() => {
    if (!stats?.byProvider) return [];
    return stats.byProvider.map((p) => ({
      provider: PROVIDERS[p.provider as TxProvider]?.label ?? p.provider,
      rate:     p.total > 0 ? Math.round((p.success / p.total) * 1000) / 10 : 0,
      total:    p.total,
      revenue:  p.revenue,
    }));
  }, [stats]);

  const dailyBarData = useMemo(() => {
    if (!stats?.trend) return [];
    return stats.trend.slice(-14).map((t) => ({
      date:    format(parseISO(t.date), "MMM d"),
      revenue: t.revenue,
      count:   t.count,
    }));
  }, [stats]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Payment Analytics</h3>
          <p className="text-sm text-muted-foreground">Revenue performance and transaction trends</p>
        </div>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DAYS_OPTIONS.map((d) => <SelectItem key={d} value={String(d)}>{d} days</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Revenue trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Daily Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dailyBarData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} width={55} />
              <Tooltip formatter={(v: number) => [fmtDefault(v), "Revenue"]} />
              <Bar dataKey="revenue" fill="#7c3aed" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Success rate by provider */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Success Rate by Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={successRateData} layout="vertical" margin={{ top: 4, right: 16, left: 70, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="provider" tick={{ fontSize: 12 }} width={70} />
                <Tooltip formatter={(v: number) => [`${v}%`, "Success rate"]} />
                <Bar dataKey="rate" radius={[0, 3, 3, 0]}>
                  {successRateData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Volume & revenue by provider */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Volume & Revenue by Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mt-2">
              {(stats?.byProvider ?? []).map((p, i) => {
                const maxRevenue = Math.max(...(stats?.byProvider ?? []).map((x) => x.revenue), 1);
                const pct = (p.revenue / maxRevenue) * 100;
                return (
                  <div key={p.provider} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        {PROVIDERS[p.provider as TxProvider]?.label ?? p.provider}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-xs">{p.total} tx</span>
                        <span className="font-semibold">{fmtDefault(p.revenue)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
              {!stats?.byProvider.length && (
                <div className="text-center py-8 text-sm text-muted-foreground">No provider data available</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Transactions", value: String(stats?.summary.totalTx ?? 0), icon: ShoppingCart },
          { label: "Total Revenue",      value: stats ? fmtDefault(stats.summary.totalRevenue) : "—", icon: DollarSign },
          { label: "Success Rate",       value: stats ? `${stats.summary.successRate}%` : "—", icon: Percent },
          { label: "Avg Order Value",    value: stats ? fmtDefault(stats.summary.avgOrderValue) : "—", icon: TrendingUp },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-base font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Payment Links Tab ─────────────────────────────────────────────────────────
function PaymentLinksTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { defaultCurrency } = useBranding();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    provider: "stripe", title: "", description: "", amount: "",
    currency: "USD", customerName: "", customerEmail: "", expiresInDays: "7",
  });
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    if (defaultCurrency) setForm((f) => ({ ...f, currency: defaultCurrency }));
  }, [defaultCurrency]);

  const { data: links = [], isLoading } = useQuery<PaymentLink[]>({
    queryKey: ["payment-links"],
    queryFn: () => apiGet("/api/payments/links"),
  });

  const createMut = useMutation({
    mutationFn: (body: object) => apiPost("/api/payments/links", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-links"] });
      toast({ title: "Payment link created" });
      setShowCreate(false);
      setForm({ provider: "stripe", title: "", description: "", amount: "", currency: defaultCurrency || "USD", customerName: "", customerEmail: "", expiresInDays: "7" });
    },
    onError: () => toast({ title: "Failed to create link", variant: "destructive" }),
  });

  const cancelMut = useMutation({
    mutationFn: ({ id }: { id: number }) => apiPatch(`/api/payments/links/${id}`, { status: "cancelled" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-links"] });
      toast({ title: "Link cancelled" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: ({ id }: { id: number }) => apiDelete(`/api/payments/links/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-links"] });
      toast({ title: "Link deleted" });
    },
  });

  function copyLink(link: PaymentLink) {
    const url = link.linkUrl ?? `${window.location.origin}/pay/${link.linkToken}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Payment Links</h3>
          <p className="text-sm text-muted-foreground">Generate shareable links to collect payments from customers</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Create Link
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total",     count: links.length,                           cls: "text-foreground" },
          { label: "Active",    count: links.filter((l) => l.status === "active").length,   cls: "text-blue-600" },
          { label: "Paid",      count: links.filter((l) => l.status === "paid").length,     cls: "text-green-600" },
          { label: "Expired",   count: links.filter((l) => l.status === "expired" || l.status === "cancelled").length, cls: "text-muted-foreground" },
        ].map(({ label, count, cls }) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${cls}`}>{count}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Title</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.map((link) => (
                    <TableRow key={link.id} className="hover:bg-muted/30">
                      <TableCell>
                        <p className="text-sm font-medium">{link.title}</p>
                        {link.description && <p className="text-xs text-muted-foreground truncate max-w-40">{link.description}</p>}
                      </TableCell>
                      <TableCell><ProviderBadge provider={link.provider} /></TableCell>
                      <TableCell className="text-right font-semibold text-sm">
                        {fmtCurrency(link.amount, link.currency)}
                      </TableCell>
                      <TableCell>
                        {link.customerName ? (
                          <div>
                            <p className="text-sm">{link.customerName}</p>
                            <p className="text-xs text-muted-foreground">{link.customerEmail}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Anyone</span>
                        )}
                      </TableCell>
                      <TableCell><StatusBadge status={link.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {link.expiresAt ? format(parseISO(link.expiresAt), "MMM d, yyyy") : "Never"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(parseISO(link.createdAt), "MMM d")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <button title="Copy link" onClick={() => copyLink(link)}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                            {copiedId === link.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                          {link.linkUrl && (
                            <a href={link.linkUrl} target="_blank" rel="noopener noreferrer" title="Open link"
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {link.status === "active" && (
                            <button title="Cancel" onClick={() => cancelMut.mutate({ id: link.id })}
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-red-500 transition-colors">
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button title="Delete" onClick={() => deleteMut.mutate({ id: link.id })}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-red-500 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!links.length && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        <Link2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        No payment links yet. Create one to start collecting payments.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Link Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Create Payment Link
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Title *</Label>
                <Input placeholder="e.g. Invoice #INV-2024-001" value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Description</Label>
                <Input placeholder="Optional description" value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Amount *</Label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Currency *</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["USD","EUR","GBP","NGN","GHS","KES","ZAR","AED","INR","CAD","AUD","JPY","CNY","BRL","MXN","SAR","EGP","TZS","UGX","XOF","XAF"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Payment Provider *</Label>
                <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROVIDERS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Customer Name</Label>
                <Input placeholder="Optional" value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Customer Email</Label>
                <Input placeholder="Optional" value={form.customerEmail}
                  onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Expires In</Label>
                <Select value={form.expiresInDays} onValueChange={(v) => setForm({ ...form, expiresInDays: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 day</SelectItem>
                    <SelectItem value="3">3 days</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={() => createMut.mutate({ ...form, amount: Number(form.amount) })}
              disabled={!form.title || !form.amount || createMut.isPending}
            >
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Create Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "dashboard",    label: "Dashboard",       icon: LayoutDashboard },
  { id: "transactions", label: "Transactions",    icon: CreditCard },
  { id: "analytics",   label: "Analytics",        icon: BarChart2 },
  { id: "links",       label: "Payment Links",    icon: Link2 },
];

export default function PaymentsPage() {
  const { defaultCurrency } = useBranding();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [dashDays, setDashDays] = useState(30);

  useEffect(() => {
    if (defaultCurrency) setGlobalCurrency(defaultCurrency);
  }, [defaultCurrency]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
            </div>
            <p className="text-sm text-muted-foreground ml-12">
              Monitor revenue, manage transactions, and generate payment links
            </p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-muted/40 border rounded-xl p-1 w-fit">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === id
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "dashboard"    && <DashboardTab days={dashDays} setDays={setDashDays} />}
        {activeTab === "transactions" && <TransactionsTab />}
        {activeTab === "analytics"    && <AnalyticsTab />}
        {activeTab === "links"        && <PaymentLinksTab />}
      </div>
    </div>
  );
}
