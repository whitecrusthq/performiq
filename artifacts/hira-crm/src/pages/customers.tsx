import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getChannelIcon, getChannelColor } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Download, Filter, Mail, Phone, MessageSquare, Loader2,
  Users, UserPlus, Calendar, TrendingUp, RefreshCw, Instagram, Facebook, Activity,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Link } from "wouter";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { apiGet } from "@/lib/api";

interface ApiCustomer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  channel: "whatsapp" | "facebook" | "instagram";
  tags: string[];
  notes: string | null;
  totalConversations: number;
  lastSeen: string | null;
}
interface CustomersResponse { total: number; customers: ApiCustomer[]; }

interface ContactsAnalytics {
  summary: { totalContacts: number; newToday: number; newThisWeek: number; newThisMonth: number; monthlyGrowthPct: number };
  newContactsTrend: Array<{ date: string; count: number }>;
  totalGrowthTrend: Array<{ date: string; total: number }>;
  contactsByPlatform: Array<{ channel: string; count: number; percentage: number }>;
  growthSummary: { activeInPeriod: number; topPlatform: string; topPlatformCount: number; avgConversations: number };
  days: number;
}

const CHANNEL_CONFIG = {
  whatsapp: {
    label: "WhatsApp",
    bg: "bg-green-50 dark:bg-green-950/30",
    border: "border-green-100 dark:border-green-900",
    accent: "text-green-600 dark:text-green-400",
    Icon: () => (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.557 4.123 1.529 5.855L.057 23.885a.5.5 0 0 0 .611.612l6.101-1.524A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.877 0-3.659-.506-5.191-1.393l-.371-.218-3.844.96.96-3.787-.231-.382A10 10 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
      </svg>
    ),
  },
  instagram: { label: "Instagram", bg: "bg-pink-50 dark:bg-pink-950/30", border: "border-pink-100 dark:border-pink-900", accent: "text-pink-600 dark:text-pink-400", Icon: Instagram },
  facebook: { label: "Facebook", bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-100 dark:border-blue-900", accent: "text-blue-600 dark:text-blue-400", Icon: Facebook },
} as const;

function channelLabel(ch: string) {
  return CHANNEL_CONFIG[ch as keyof typeof CHANNEL_CONFIG]?.label ?? (ch.charAt(0).toUpperCase() + ch.slice(1));
}

function MiniTrendCard({ title, dataKey, color, data }: {
  title: string;
  dataKey: string;
  color: string;
  data: Array<Record<string, unknown>>;
}) {
  const values = data.map((d) => d[dataKey] as number);
  const latest = values[values.length - 1] ?? 0;
  const peak = values.length ? Math.max(...values) : 0;
  const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;

  const ticks: string[] = [];
  if (data.length > 0) {
    ticks.push(data[0].date as string);
    if (data.length > 1) ticks.push(data[Math.floor(data.length / 2)].date as string);
    ticks.push(data[data.length - 1].date as string);
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
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" ticks={ticks} dy={8} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
              <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-8 pt-4 mt-2 border-t">
          <div className="text-center"><div className="text-xl font-bold">{latest}</div><div className="text-xs text-muted-foreground">Latest</div></div>
          <div className="text-center"><div className="text-xl font-bold">{peak}</div><div className="text-xs text-muted-foreground">Peak</div></div>
          <div className="text-center"><div className="text-xl font-bold">{avg}</div><div className="text-xs text-muted-foreground">Avg</div></div>
        </div>
      </CardContent>
    </Card>
  );
}

function ContactsAnalyticsTab() {
  const qc = useQueryClient();
  const [days, setDays] = useState("30");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);

  const params = new URLSearchParams({ days, channel: platformFilter });
  const { data, isLoading, isFetching } = useQuery<ContactsAnalytics>({
    queryKey: ["contacts-analytics", days, platformFilter, refreshKey],
    queryFn: () => apiGet(`/customers/analytics/summary?${params.toString()}`),
    staleTime: 60000,
  });

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    qc.invalidateQueries({ queryKey: ["contacts-analytics"] });
  };

  const s = data?.summary;
  const gSummary = data?.growthSummary;

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Contacts Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Track contact growth and engagement across all platforms</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[150px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
            </SelectContent>
          </Select>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2 h-9" data-testid="button-refresh-contacts-analytics">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Contacts</p>
                <p className="text-3xl font-bold mt-1">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mt-1" /> : (s?.totalContacts ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                <Users className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">New Today</p>
                <p className="text-3xl font-bold mt-1">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mt-1" /> : (s?.newToday ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <UserPlus className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">New This Week</p>
                <p className="text-3xl font-bold mt-1">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mt-1" /> : (s?.newThisWeek ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center shrink-0">
                <Calendar className="h-6 w-6 text-sky-600 dark:text-sky-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Monthly Growth</p>
                <p className="text-3xl font-bold mt-1">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mt-1" /> : `${s?.monthlyGrowthPct ?? 0}%`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{(s?.newThisMonth ?? 0).toLocaleString()} new contacts</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                <TrendingUp className="h-6 w-6 text-orange-500" />
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
          <MiniTrendCard title="New Contacts Trend" dataKey="count" color="#8b5cf6" data={data?.newContactsTrend ?? []} />
          <MiniTrendCard title="Total Contacts Growth" dataKey="total" color="#0ea5e9" data={data?.totalGrowthTrend ?? []} />
        </div>
      )}

      {/* Contacts by Platform */}
      <div>
        <h2 className="text-base font-semibold mb-4">Contacts by Platform</h2>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <Card key={i}><CardContent className="pt-6 flex justify-center items-center h-[100px]"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["whatsapp", "facebook", "instagram"] as const).map((channelKey) => {
              const cfg = CHANNEL_CONFIG[channelKey];
              const stat = (data?.contactsByPlatform ?? []).find((p) => p.channel === channelKey) ?? { channel: channelKey, count: 0, percentage: 0 };
              return (
                <Card key={channelKey} className={`${cfg.bg} ${cfg.border} border`}>
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <cfg.Icon className={`h-5 w-5 ${cfg.accent}`} />
                        <span className="font-semibold text-sm">{cfg.label}</span>
                      </div>
                      <span className={`text-2xl font-bold ${cfg.accent}`}>{stat.count.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Percentage of total</span>
                      <span className={`font-semibold ${cfg.accent}`}>{stat.percentage}%</span>
                    </div>
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${channelKey === "whatsapp" ? "bg-green-500" : channelKey === "instagram" ? "bg-pink-500" : "bg-blue-500"}`}
                        style={{ width: `${stat.percentage}%` }} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Contact Growth Summary */}
      <div>
        <h2 className="text-base font-semibold mb-4">Contact Growth Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="text-sm text-muted-foreground">Active Contacts</div>
              </div>
              <div className="text-2xl font-bold">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (gSummary?.activeInPeriod ?? 0).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Had a conversation in selected period</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-sm text-muted-foreground">Top Platform</div>
              </div>
              <div className="text-2xl font-bold capitalize">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : channelLabel(gSummary?.topPlatform ?? "whatsapp")}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{(gSummary?.topPlatformCount ?? 0).toLocaleString()} total contacts</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                </div>
                <div className="text-sm text-muted-foreground">Avg. Conversations</div>
              </div>
              <div className="text-2xl font-bold">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (gSummary?.avgConversations ?? 0)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Per contact in selected period</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function Customers() {
  const [tab, setTab] = useState<"contacts" | "analytics">("contacts");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<ApiCustomer | null>(null);

  const params = new URLSearchParams({ limit: "50" });
  if (searchQuery) params.set("search", searchQuery);

  const { data, isLoading } = useQuery<CustomersResponse>({
    queryKey: ["customers", searchQuery],
    queryFn: () => apiGet(`/customers?${params.toString()}`),
    staleTime: 10000,
    enabled: tab === "contacts",
  });

  const customers = data?.customers ?? [];

  return (
    <div className="h-full flex flex-col">
      {/* Page Header */}
      <div className="px-8 pt-6 pb-0 shrink-0 bg-background border-b">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Manage your contacts and track growth across platforms.</p>
          </div>
          {tab === "contacts" && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" /> Export CSV
              </Button>
              <Button size="sm" className="gap-2">Add Customer</Button>
            </div>
          )}
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "contacts" | "analytics")}>
          <TabsList className="h-9 bg-transparent border-none gap-0 -mb-px">
            <TabsTrigger value="contacts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 gap-2">
              <Users className="h-4 w-4" /> Contacts
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 gap-2">
              <TrendingUp className="h-4 w-4" /> Analytics
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {tab === "analytics" ? (
          <div className="h-full overflow-auto">
            <ContactsAnalyticsTab />
          </div>
        ) : (
          <div className="p-6 h-full flex flex-col gap-4">
            <Card className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between shrink-0 bg-muted/20">
                <div className="relative w-80">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, phone..."
                    className="pl-9 bg-background"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-customers"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{data?.total ?? 0} contacts</Badge>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Filter className="h-4 w-4" /> Filters
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Interactions</TableHead>
                      <TableHead>Last Seen</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ) : customers.map((customer) => {
                      const Icon = getChannelIcon(customer.channel);
                      return (
                        <TableRow key={customer.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedCustomer(customer)} data-testid={`customer-row-${customer.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback>{customer.name.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{customer.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{customer.phone ?? "—"}</div>
                              <div className="text-muted-foreground text-xs">{customer.email ?? "—"}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Icon className={`h-4 w-4 ${getChannelColor(customer.channel)}`} />
                              <span className="capitalize">{customer.channel}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(customer.tags ?? []).map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs bg-muted">{tag}</Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{customer.totalConversations}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {customer.lastSeen ? formatDistanceToNow(new Date(customer.lastSeen), { addSuffix: true }) : "—"}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedCustomer(customer); }}>
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!isLoading && customers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No customers found</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Customer Detail Sheet */}
      <Sheet open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          {selectedCustomer && (
            <div className="mt-6 space-y-6">
              <div className="flex flex-col items-center text-center space-y-3 pb-6 border-b">
                <Avatar className="h-24 w-24 border-4 border-background shadow-sm">
                  <AvatarFallback className="text-2xl">{selectedCustomer.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-2xl font-bold">{selectedCustomer.name}</h2>
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-1">
                    {(() => { const Icon = getChannelIcon(selectedCustomer.channel); return <Icon className={`h-4 w-4 ${getChannelColor(selectedCustomer.channel)}`} />; })()}
                    Preferred: <span className="capitalize text-foreground">{selectedCustomer.channel}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <Link href="/inbox">
                    <Button className="gap-2" data-testid="button-message-customer">
                      <MessageSquare className="h-4 w-4" /> Message
                    </Button>
                  </Link>
                  <Button variant="outline" className="gap-2">Edit Profile</Button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Contact Info</h3>
                <div className="space-y-3 bg-muted/30 p-4 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{selectedCustomer.phone ?? "Not provided"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{selectedCustomer.email ?? "Not provided"}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {(selectedCustomer.tags ?? []).map((tag) => (
                    <Badge key={tag} variant="secondary" className="px-3 py-1 bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer">{tag}</Badge>
                  ))}
                  <Button variant="outline" size="sm" className="h-6 rounded-full text-xs">+ Add Tag</Button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Notes</h3>
                <div className="bg-muted/30 p-4 rounded-lg border text-sm">
                  {selectedCustomer.notes ? <p>{selectedCustomer.notes}</p> : <p className="text-muted-foreground italic">No notes added yet.</p>}
                  <Button variant="link" className="px-0 h-auto text-xs mt-2">Edit Notes</Button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Interaction Summary</h3>
                <div className="bg-muted/30 p-4 rounded-lg border text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total conversations</span>
                    <span className="font-medium">{selectedCustomer.totalConversations}</span>
                  </div>
                  {selectedCustomer.lastSeen && (
                    <div className="flex justify-between mt-2">
                      <span className="text-muted-foreground">Last seen</span>
                      <span className="font-medium">{formatDistanceToNow(new Date(selectedCustomer.lastSeen), { addSuffix: true })}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
