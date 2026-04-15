import { useAuth } from "@/hooks/use-auth";
import { useGetDashboard } from "../lib";
import { PageHeader, Card, StatusBadge, EmptyState } from "@/components/shared";
import { Users, Target, ClipboardList, TrendingUp, Calendar, ShieldCheck, CalendarDays } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

interface StatCardProps {
  title: string;
  value: number | string | null | undefined;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
}

function StatCard({ title, value, icon: Icon, colorClass }: StatCardProps) {
  return (
    <Card className="p-6 flex items-center gap-5">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${colorClass}`}>
        <Icon className="w-7 h-7" />
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
        <h3 className="text-3xl font-display font-bold text-foreground">{value ?? 0}</h3>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading, isError } = useGetDashboard({
    request: { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
  });

  if (isLoading) return (
    <div className="animate-pulse space-y-8">
      <div className="h-10 w-1/3 bg-muted rounded-lg"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="h-32 bg-muted rounded-2xl"></div>
        <div className="h-32 bg-muted rounded-2xl"></div>
        <div className="h-32 bg-muted rounded-2xl"></div>
      </div>
    </div>
  );

  if (isError || !stats) return <div className="text-destructive">Failed to load dashboard</div>;

  const recentAppraisals = stats.recentAppraisals ?? [];
  const recentGoals = stats.recentGoals ?? [];

  return (
    <div className="space-y-8">
      <PageHeader 
        title={`Welcome back, ${(user?.name ?? user?.email ?? 'there').split(' ')[0]}`} 
        description="Here's what's happening with your performance metrics today."
      />

      {(user?.role === 'admin' || user?.role === 'super_admin') && (stats as any).awaitingApproval > 0 && (
        <Link href="/appraisals" className="block">
          <div className="flex items-center gap-4 p-4 bg-purple-50 border border-purple-200 rounded-2xl cursor-pointer hover:bg-purple-100 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-purple-800">
                {(stats as any).awaitingApproval} appraisal{(stats as any).awaitingApproval !== 1 ? 's' : ''} awaiting your approval
              </p>
              <p className="text-sm text-purple-600">Manager reviews are complete — click to review and approve</p>
            </div>
            <span className="text-sm font-medium text-purple-700 underline">Review →</span>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard title="Pending Appraisals" value={stats.pendingAppraisals} icon={ClipboardList} colorClass="bg-amber-100 text-amber-600" />
        <StatCard title="Awaiting Approval" value={(stats as any).awaitingApproval ?? '-'} icon={ShieldCheck} colorClass="bg-purple-100 text-purple-600" />
        <StatCard title="Completed Reviews" value={stats.completedAppraisals} icon={TrendingUp} colorClass="bg-emerald-100 text-emerald-600" />
        <StatCard title="Active Goals" value={stats.activeGoals} icon={Target} colorClass="bg-blue-100 text-blue-600" />
        
        {user?.role === 'manager' && (
          <StatCard title="Team Size" value={stats.teamSize} icon={Users} colorClass="bg-purple-100 text-purple-600" />
        )}
      </div>

      {/* Leave Balance Card */}
      {(stats as any).leaveBalance?.balances?.length > 0 && (
        <Card className="overflow-hidden">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-teal-500" />
              Leave Balance
              <span className="text-xs font-normal text-muted-foreground ml-1">({(stats as any).leaveBalance.cycleYear})</span>
            </h3>
            <Link href="/leave" className="text-sm font-medium text-primary hover:underline">Manage leave</Link>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
              {(stats as any).leaveBalance.balances.map((b: any) => {
                const pct = b.allocated > 0 ? Math.round((b.used / b.allocated) * 100) : 0;
                return (
                  <div key={b.leaveType} className="text-center">
                    <p className="text-xs font-medium text-muted-foreground mb-2">{b.label || b.leaveType}</p>
                    <div className="relative w-16 h-16 mx-auto mb-2">
                      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-secondary" />
                        <circle
                          cx="18" cy="18" r="15" fill="none" strokeWidth="3"
                          strokeDasharray={`${pct * 0.94} 100`}
                          strokeLinecap="round"
                          className={pct > 80 ? "text-red-500" : pct > 50 ? "text-amber-500" : "text-green-500"}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{b.remaining}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{b.used}/{b.allocated} used</p>
                  </div>
                );
              })}
            </div>
            {(stats as any).leaveBalance.pendingLeaveRequests > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <Link href="/leave" className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 inline-flex items-center gap-2 hover:bg-amber-100 transition-colors">
                  <CalendarDays className="w-4 h-4" />
                  {(stats as any).leaveBalance.pendingLeaveRequests} pending leave request{(stats as any).leaveBalance.pendingLeaveRequests !== 1 ? 's' : ''}
                </Link>
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
        {/* Recent Appraisals */}
        <Card className="flex flex-col h-full">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              Recent Appraisals
            </h3>
            <Link href="/appraisals" className="text-sm font-medium text-primary hover:underline">View all</Link>
          </div>
          <div className="p-0 flex-1">
            {recentAppraisals.length === 0 ? (
              <EmptyState title="No recent appraisals" description="There are no appraisals requiring your attention right now." icon={ClipboardList} />
            ) : (
              <div className="divide-y divide-border">
                {recentAppraisals.map(app => (
                  <Link key={app.id} href={`/appraisals/${app.id}`} className="flex items-center justify-between p-4 sm:p-6 hover:bg-muted/50 transition-colors block">
                    <div>
                      <p className="font-semibold text-foreground">{(app as any).employee?.name ?? '—'}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {(app as any).cycle?.name ?? '—'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge status={app.status} type="appraisal" />
                      {app.overallScore !== null && app.overallScore !== undefined && (
                        <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">Score: {Number(app.overallScore).toFixed(1)}</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Recent Goals */}
        <Card className="flex flex-col h-full">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-500" />
              Recent Goals
            </h3>
            <Link href="/goals" className="text-sm font-medium text-primary hover:underline">View all</Link>
          </div>
          <div className="p-0 flex-1">
            {recentGoals.length === 0 ? (
              <EmptyState title="No recent goals" description="Get started by creating a new performance goal." icon={Target} />
            ) : (
              <div className="divide-y divide-border">
                {recentGoals.map(goal => (
                  <Link key={goal.id} href={`/goals`} className="flex flex-col p-4 sm:p-6 hover:bg-muted/50 transition-colors block">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-foreground line-clamp-1">{goal.title}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">For {(goal as any).user?.name ?? (goal as any).user?.email ?? '—'}</p>
                      </div>
                      <StatusBadge status={goal.status} type="goal" />
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2 mt-2 overflow-hidden">
                      <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${goal.progress ?? 0}%` }}></div>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs font-medium text-muted-foreground">{goal.progress ?? 0}% Complete</span>
                      {goal.dueDate && <span className="text-xs text-muted-foreground">Due: {format(new Date(goal.dueDate), 'MMM d, yyyy')}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
