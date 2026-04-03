import React from "react";
import { agents } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, LineChart, Line } from "recharts";

const performanceData = [
  { time: '08:00', volume: 120, avgResponse: 140 },
  { time: '10:00', volume: 280, avgResponse: 180 },
  { time: '12:00', volume: 450, avgResponse: 240 },
  { time: '14:00', volume: 380, avgResponse: 190 },
  { time: '16:00', volume: 510, avgResponse: 280 },
  { time: '18:00', volume: 320, avgResponse: 150 },
  { time: '20:00', volume: 190, avgResponse: 110 },
];

const resolutionData = [
  { name: 'Mon', resolved: 400, escalated: 24 },
  { name: 'Tue', resolved: 300, escalated: 13 },
  { name: 'Wed', resolved: 550, escalated: 38 },
  { name: 'Thu', resolved: 420, escalated: 39 },
  { name: 'Fri', resolved: 600, escalated: 48 },
  { name: 'Sat', resolved: 250, escalated: 19 },
  { name: 'Sun', resolved: 210, escalated: 15 },
];

export default function Analytics() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-1">Deep dive into your team's performance metrics.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Daily Volume vs Response Time</CardTitle>
            <CardDescription>Correlation between ticket volume and speed</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="volume" name="Tickets" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="avgResponse" name="Response (s)" stroke="#f59e0b" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Resolution Breakdown</CardTitle>
            <CardDescription>Resolved vs Escalated tickets this week</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={resolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  cursor={{ fill: 'hsl(var(--muted))' }}
                />
                <Legend />
                <Bar dataKey="resolved" name="Resolved" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                <Bar dataKey="escalated" name="Escalated" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Agent Leaderboard</CardTitle>
            <CardDescription>Top performers based on resolution count and CSAT</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {agents.sort((a, b) => b.resolvedToday - a.resolvedToday).map((agent, i) => (
                <div key={agent.id} className="flex items-center">
                  <div className="w-8 text-center font-bold text-muted-foreground mr-2">#{i + 1}</div>
                  <Avatar className="h-10 w-10 mr-4">
                    <AvatarImage src={agent.avatar} />
                    <AvatarFallback>{agent.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium leading-none">{agent.name}</p>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">{agent.resolvedToday} resolved</span>
                        <span className="text-sm font-medium text-amber-500 flex items-center">
                          ★ {agent.rating}
                        </span>
                      </div>
                    </div>
                    <Progress value={(agent.resolvedToday / 30) * 100} className="h-2" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>AI Deflection</CardTitle>
            <CardDescription>Tickets handled fully by bot</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <div className="relative w-48 h-48 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="96" cy="96" r="88" className="stroke-muted fill-none" strokeWidth="16" />
                <circle 
                  cx="96" cy="96" r="88" 
                  className="stroke-primary fill-none transition-all duration-1000 ease-in-out" 
                  strokeWidth="16" 
                  strokeDasharray="552.9" 
                  strokeDashoffset="193.5" // 65% of 552.9
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-4xl font-bold">65%</span>
                <span className="text-sm text-muted-foreground mt-1">Deflection Rate</span>
              </div>
            </div>
            <div className="mt-8 text-center text-sm text-muted-foreground">
              Bot resolved <span className="font-medium text-foreground">842</span> out of <span className="font-medium text-foreground">1,295</span> total inquiries today without agent intervention.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
