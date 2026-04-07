import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getChannelIcon, getChannelColor, getChannelMeta, getStatusColor } from "@/lib/mock-data";
import { AreaChart, Area, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, XAxis, PieChart, Pie, Cell } from "recharts";
import { MessageSquare, Clock, CheckCircle2, TrendingUp, Loader2, Megaphone } from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { apiGet } from "@/lib/api";

const volumeData = [
  { name: 'Mon', whatsapp: 400, facebook: 240, instagram: 150 },
  { name: 'Tue', whatsapp: 300, facebook: 139, instagram: 220 },
  { name: 'Wed', whatsapp: 550, facebook: 380, instagram: 290 },
  { name: 'Thu', whatsapp: 420, facebook: 390, instagram: 200 },
  { name: 'Fri', whatsapp: 600, facebook: 480, instagram: 350 },
  { name: 'Sat', whatsapp: 250, facebook: 190, instagram: 420 },
  { name: 'Sun', whatsapp: 210, facebook: 150, instagram: 380 },
];

const CHANNEL_COLORS: Record<string, string> = { whatsapp: '#25D366', facebook: '#1877F2', instagram: '#E4405F' };
const CHANNEL_LABELS: Record<string, string> = { whatsapp: 'WhatsApp', facebook: 'Facebook', instagram: 'Instagram' };

interface DashboardData {
  kpis: {
    openConversations: number;
    pendingConversations: number;
    resolvedToday: number;
    totalCustomers: number;
    agentsOnline: number;
    resolutionRate: number;
    avgResponseMinutes: number;
    csatScore: number;
  };
  channelBreakdown: Array<{ channel: string; count: number }>;
  recentActivity: Array<{
    id: number;
    channel: string;
    status: string;
    lastMessageAt: string;
    customer: { name: string; channel: string };
  }>;
  campaigns: {
    total: number;
    sent: number;
    byChannel: Array<{ channel: string; count: number }>;
    recent: Array<{ id: number; name: string; channel: string; status: string; recipients: number }>;
  };
}

export default function Dashboard() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => apiGet("/dashboard"),
    refetchInterval: 30000,
  });

  const channelData = (data?.channelBreakdown ?? []).map((r) => ({
    name: CHANNEL_LABELS[r.channel] ?? r.channel,
    value: r.count,
    color: CHANNEL_COLORS[r.channel] ?? '#888',
  }));

  return (
    <div className="p-8 space-y-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Here's what's happening with your team today.</p>
        </div>
        {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="kpi-open-conversations">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Conversations</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.kpis.openConversations ?? "—"}</div>
            <p className="text-xs text-muted-foreground mt-1">{data?.kpis.pendingConversations ?? 0} pending</p>
          </CardContent>
        </Card>
        <Card data-testid="kpi-response-time">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data ? `${data.kpis.avgResponseMinutes}m` : "—"}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center text-green-600">
              <TrendingUp className="h-3 w-3 mr-1" /> On track
            </p>
          </CardContent>
        </Card>
        <Card data-testid="kpi-resolution-rate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data ? `${data.kpis.resolutionRate}%` : "—"}</div>
            <p className="text-xs text-muted-foreground mt-1">{data?.kpis.resolvedToday ?? 0} resolved today</p>
          </CardContent>
        </Card>
        <Card data-testid="kpi-csat">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CSAT Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data ? `${data.kpis.csatScore}/5.0` : "—"}</div>
            <p className="text-xs text-muted-foreground mt-1">{data?.kpis.totalCustomers ?? 0} total customers</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-7 lg:grid-cols-7">
        <Card className="md:col-span-4 lg:col-span-5">
          <CardHeader>
            <CardTitle>Conversation Volume</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volumeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorWa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#25D366" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#25D366" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorFb" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1877F2" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#1877F2" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} itemStyle={{ color: 'hsl(var(--foreground))' }} />
                <Area type="monotone" dataKey="whatsapp" stroke="#25D366" strokeWidth={2} fillOpacity={1} fill="url(#colorWa)" />
                <Area type="monotone" dataKey="facebook" stroke="#1877F2" strokeWidth={2} fillOpacity={1} fill="url(#colorFb)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="md:col-span-3 lg:col-span-2">
          <CardHeader>
            <CardTitle>Channel Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={channelData.length ? channelData : [{ name: 'No data', value: 1, color: '#e5e7eb' }]} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                  {(channelData.length ? channelData : [{ name: 'No data', value: 1, color: '#e5e7eb' }]).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-4 w-full justify-center text-sm">
              {channelData.map((channel) => (
                <div key={channel.name} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: channel.color }} />
                  <span className="text-muted-foreground">{channel.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-1">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Activity</CardTitle>
            <Link href="/inbox" className="text-sm text-primary hover:underline" data-testid="link-view-all-inbox">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (data?.recentActivity ?? []).map((conv) => {
                const Icon = getChannelIcon(conv.channel);
                return (
                  <div key={conv.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors" data-testid={`activity-item-${conv.id}`}>
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-base font-semibold">
                          {conv.customer.name.charAt(0)}
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-black rounded-full p-0.5">
                          <Icon className={`h-3.5 w-3.5 ${getChannelColor(conv.channel)}`} />
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">{conv.customer.name}</div>
                        <div className="text-sm text-muted-foreground">{getChannelMeta(conv.channel).label} conversation</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="secondary" className={getStatusColor(conv.status as "open" | "ongoing" | "pending" | "resolved" | "closed")}>
                        {conv.status.charAt(0).toUpperCase() + conv.status.slice(1)}
                      </Badge>
                      <div className="text-sm text-muted-foreground w-20 text-right">
                        {conv.lastMessageAt ? formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true, includeSeconds: false }).replace('about ', '') : 'recently'}
                      </div>
                    </div>
                  </div>
                );
              })}
              {!isLoading && (data?.recentActivity ?? []).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">No recent activity</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Campaigns</h2>
          </div>
          <Link href="/campaigns" className="text-sm text-primary hover:underline" data-testid="link-view-all-campaigns">
            View all
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Campaigns</p>
                  <p className="text-2xl font-bold">{data?.campaigns?.total ?? "—"}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-11 w-11 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 shrink-0">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sent</p>
                  <p className="text-2xl font-bold">{data?.campaigns?.sent ?? "—"}</p>
                </div>
              </CardContent>
            </Card>
            {/* Per-channel breakdown */}
            {(data?.campaigns?.byChannel ?? []).map((item) => {
              const Icon = getChannelIcon(item.channel);
              const meta = getChannelMeta(item.channel);
              return (
                <Card key={item.channel} className={`border ${meta.border} ${meta.bg}`}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <Icon className={`h-5 w-5 shrink-0 ${meta.textColor}`} />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{meta.label}</p>
                      <p className="text-xl font-bold">{item.count}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Recent campaigns */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Recent Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (data?.campaigns?.recent ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No campaigns yet</p>
              ) : (
                <div className="space-y-3">
                  {(data?.campaigns?.recent ?? []).map((c) => {
                    const Icon = getChannelIcon(c.channel);
                    const meta = getChannelMeta(c.channel);
                    return (
                      <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${meta.bg}`}>
                            <Icon className={`h-4 w-4 ${meta.textColor}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{meta.label} · {c.recipients.toLocaleString()} recipients</p>
                          </div>
                        </div>
                        <Badge
                          variant="secondary"
                          className={
                            c.status === "sent" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-none" :
                            c.status === "scheduled" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-none" :
                            "text-muted-foreground"
                          }
                        >
                          {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
