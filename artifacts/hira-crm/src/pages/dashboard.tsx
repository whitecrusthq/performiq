import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { conversations, getChannelIcon, getChannelColor, getStatusColor } from "@/lib/mock-data";
import { AreaChart, Area, XChart, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, PieChart, Pie, Cell } from "recharts";
import { MessageSquare, Clock, CheckCircle2, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";

const volumeData = [
  { name: 'Mon', whatsapp: 400, facebook: 240, instagram: 150 },
  { name: 'Tue', whatsapp: 300, facebook: 139, instagram: 220 },
  { name: 'Wed', whatsapp: 550, facebook: 380, instagram: 290 },
  { name: 'Thu', whatsapp: 420, facebook: 390, instagram: 200 },
  { name: 'Fri', whatsapp: 600, facebook: 480, instagram: 350 },
  { name: 'Sat', whatsapp: 250, facebook: 190, instagram: 420 },
  { name: 'Sun', whatsapp: 210, facebook: 150, instagram: 380 },
];

const channelData = [
  { name: 'WhatsApp', value: 55, color: '#25D366' },
  { name: 'Facebook', value: 30, color: '#1877F2' },
  { name: 'Instagram', value: 15, color: '#E4405F' },
];

export default function Dashboard() {
  const recentConversations = conversations.slice(0, 4);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Here's what's happening with your team today.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,248</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center text-green-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              +12% from yesterday
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2m 14s</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center text-green-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              -18s from yesterday
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">89.4%</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center text-green-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              +2.1% from yesterday
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CSAT Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4.8/5.0</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center text-gray-500">
              No change from yesterday
            </p>
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
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
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
                <Pie
                  data={channelData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {channelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                />
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
              {recentConversations.map((conv) => {
                const Icon = getChannelIcon(conv.channel);
                return (
                  <div key={conv.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors" data-testid={`activity-item-${conv.id}`}>
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <img src={conv.customer.avatar} alt={conv.customer.name} className="h-10 w-10 rounded-full object-cover" />
                        <div className={`absolute -bottom-1 -right-1 bg-white dark:bg-black rounded-full p-0.5`}>
                          <Icon className={`h-3.5 w-3.5 ${getChannelColor(conv.channel)}`} />
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">{conv.customer.name}</div>
                        <div className="text-sm text-muted-foreground truncate max-w-[300px]">
                          {conv.messages[conv.messages.length - 1]?.content || "Started a conversation"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="secondary" className={getStatusColor(conv.status)}>
                        {conv.status.charAt(0).toUpperCase() + conv.status.slice(1)}
                      </Badge>
                      <div className="text-sm text-muted-foreground w-20 text-right">
                        {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true, includeSeconds: false }).replace('about ', '')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
