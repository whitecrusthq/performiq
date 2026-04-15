import { useState, useEffect } from "react";
import { PageHeader, Card } from "@/components/shared";
import { Award, Trophy, Crown, Medal, Filter, ArrowUp, ArrowDown, Cake, Star, Users, Calendar } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/utils";

interface AnniversaryUser {
  id: number;
  name: string;
  department: string | null;
  jobTitle: string | null;
  startDate: string;
  profilePhoto: string | null;
  site: string | null;
  yearsOfService: number;
  nextAnniversary: string;
  daysUntilAnniversary: number;
  isToday: boolean;
}

type TabType = "dashboard" | "leaderboard" | "longest";

function fmt(d: string) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function Avatar({ name, photo, size = "md" }: { name: string; photo?: string | null; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "w-14 h-14 text-lg" : size === "md" ? "w-10 h-10 text-sm" : "w-8 h-8 text-xs";
  if (photo) {
    const src = photo.startsWith("/objects/") ? `/api/storage${photo}` : photo;
    return <img src={src} alt={name} className={`${sizeClass} rounded-full object-cover`} />;
  }
  return (
    <div className={`${sizeClass} rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function pluralize(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default function Anniversaries() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<AnniversaryUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [leaderboardSort, setLeaderboardSort] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch("/api/anniversaries");
        if (r.ok) setStaff(await r.json());
      } catch {}
      setIsLoading(false);
    })();
  }, []);

  const departments = [...new Set(staff.map(s => s.department).filter(Boolean))] as string[];

  const filtered = departmentFilter === "all" ? staff : staff.filter(s => s.department === departmentFilter);

  const todayAnniversaries = filtered.filter(s => s.isToday);
  const upcomingThisMonth = filtered.filter(s => {
    if (s.isToday) return false;
    const next = new Date(s.nextAnniversary);
    const today = new Date();
    return next.getMonth() === today.getMonth() && next.getFullYear() === today.getFullYear();
  }).sort((a, b) => a.daysUntilAnniversary - b.daysUntilAnniversary);

  const upcoming30 = filtered.filter(s => !s.isToday && s.daysUntilAnniversary <= 30 && s.daysUntilAnniversary > 0)
    .sort((a, b) => sortOrder === "asc" ? a.daysUntilAnniversary - b.daysUntilAnniversary : b.daysUntilAnniversary - a.daysUntilAnniversary);

  const leaderboard = [...filtered].sort((a, b) => leaderboardSort === "desc"
    ? b.yearsOfService - a.yearsOfService
    : a.yearsOfService - b.yearsOfService
  );

  const longestServing = [...filtered].sort((a, b) => b.yearsOfService - a.yearsOfService);
  const topEmployee = longestServing[0];

  const milestoneGroups = [
    { label: "30+ Years", min: 31, color: "from-yellow-500 to-amber-600", icon: <Crown className="w-5 h-5" /> },
    { label: "30 Years", min: 30, max: 30, color: "from-yellow-400 to-amber-500", icon: <Crown className="w-5 h-5" /> },
    { label: "25 Years", min: 25, max: 29, color: "from-purple-500 to-purple-700", icon: <Trophy className="w-5 h-5" /> },
    { label: "20 Years", min: 20, max: 24, color: "from-blue-600 to-blue-800", icon: <Trophy className="w-5 h-5" /> },
    { label: "15 Years", min: 15, max: 19, color: "from-blue-500 to-blue-700", icon: <Award className="w-5 h-5" /> },
    { label: "10 Years", min: 10, max: 14, color: "from-green-500 to-green-700", icon: <Medal className="w-5 h-5" /> },
    { label: "5 Years", min: 5, max: 9, color: "from-teal-500 to-teal-700", icon: <Star className="w-5 h-5" /> },
    { label: "1–4 Years", min: 1, max: 4, color: "from-slate-400 to-slate-600", icon: <Calendar className="w-5 h-5" /> },
  ];

  const avgYears = filtered.length > 0 ? (filtered.reduce((sum, s) => sum + s.yearsOfService, 0) / filtered.length).toFixed(1) : "0";

  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: "dashboard", label: "Dashboard", icon: <Cake className="w-4 h-4" /> },
    { key: "leaderboard", label: "Leaderboard", icon: <Trophy className="w-4 h-4" /> },
    { key: "longest", label: "Longest Serving", icon: <Crown className="w-4 h-4" /> },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Work Anniversaries" description="Celebrate milestones, view leaderboards, and recognize long-serving staff." />

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl w-fit">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === t.key ? "bg-blue-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={departmentFilter}
            onChange={e => setDepartmentFilter(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm bg-background"
          >
            <option value="all">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {activeTab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4 text-center">
              <Users className="w-6 h-6 text-blue-600 mx-auto mb-1" />
              <p className="text-2xl font-bold">{filtered.length}</p>
              <p className="text-xs text-muted-foreground">Total Staff</p>
            </Card>
            <Card className="p-4 text-center">
              <Cake className="w-6 h-6 text-pink-600 mx-auto mb-1" />
              <p className="text-2xl font-bold">{todayAnniversaries.length}</p>
              <p className="text-xs text-muted-foreground">Anniversaries Today</p>
            </Card>
            <Card className="p-4 text-center">
              <Calendar className="w-6 h-6 text-amber-600 mx-auto mb-1" />
              <p className="text-2xl font-bold">{upcomingThisMonth.length}</p>
              <p className="text-xs text-muted-foreground">This Month</p>
            </Card>
            <Card className="p-4 text-center">
              <Star className="w-6 h-6 text-green-600 mx-auto mb-1" />
              <p className="text-2xl font-bold">{avgYears}</p>
              <p className="text-xs text-muted-foreground">Avg Years of Service</p>
            </Card>
          </div>

          {todayAnniversaries.length > 0 && (
            <div>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Cake className="w-5 h-5 text-pink-600" /> Today's Anniversaries
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {todayAnniversaries.map(s => (
                  <Card key={s.id} className="p-4 border-pink-200 bg-gradient-to-br from-pink-50 to-white">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.name} photo={s.profilePhoto} size="lg" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.jobTitle ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{s.department ?? "—"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-2xl font-bold text-pink-600">{s.yearsOfService}</p>
                        <p className="text-[10px] text-pink-600 font-medium uppercase">Years</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {upcoming30.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-600" /> Upcoming (Next 30 Days)
                </h3>
                <button
                  onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
                  className="flex items-center gap-1.5 border rounded-lg px-3 py-1.5 text-sm bg-background hover:bg-secondary transition-colors"
                >
                  {sortOrder === "asc" ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
                  {sortOrder === "asc" ? "Soonest first" : "Furthest first"}
                </button>
              </div>
              <div className="space-y-2">
                {upcoming30.map(s => (
                  <Card key={s.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar name={s.name} photo={s.profilePhoto} />
                        <div>
                          <p className="font-semibold text-sm">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.department ?? "—"} {s.jobTitle ? `· ${s.jobTitle}` : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <p className="text-xs text-muted-foreground">Joined {fmt(s.startDate)}</p>
                          <p className="text-xs font-medium">{pluralize(s.yearsOfService + 1, "year")} on {fmt(s.nextAnniversary)}</p>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${s.daysUntilAnniversary <= 3 ? "bg-green-100 text-green-700 border-green-200" : s.daysUntilAnniversary <= 7 ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-amber-100 text-amber-700 border-amber-200"}`}>
                          {s.daysUntilAnniversary === 1 ? "Tomorrow" : `In ${s.daysUntilAnniversary} days`}
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {todayAnniversaries.length === 0 && upcoming30.length === 0 && (
            <Card className="p-8 text-center">
              <Cake className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No anniversaries coming up in the next 30 days</p>
            </Card>
          )}
        </div>
      )}

      {activeTab === "leaderboard" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-600" /> Service Leaderboard
            </h3>
            <button
              onClick={() => setLeaderboardSort(prev => prev === "desc" ? "asc" : "desc")}
              className="flex items-center gap-1.5 border rounded-lg px-3 py-1.5 text-sm bg-background hover:bg-secondary transition-colors"
            >
              {leaderboardSort === "desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
              {leaderboardSort === "desc" ? "Most years first" : "Fewest years first"}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 mb-4">
            {leaderboard.slice(0, 3).map((s, i) => {
              const colors = [
                "from-yellow-400 to-amber-500",
                "from-gray-300 to-gray-400",
                "from-amber-600 to-amber-700"
              ];
              const icons = [
                <Crown className="w-6 h-6 text-yellow-600" />,
                <Medal className="w-6 h-6 text-gray-500" />,
                <Medal className="w-6 h-6 text-amber-700" />
              ];
              return (
                <Card key={s.id} className="p-5 text-center relative overflow-hidden">
                  <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${colors[i]}`} />
                  <div className="mb-2">{icons[i]}</div>
                  <Avatar name={s.name} photo={s.profilePhoto} size="lg" />
                  <p className="font-bold text-sm mt-2">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.department ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{s.jobTitle ?? "—"}</p>
                  <div className="mt-2">
                    <p className="text-2xl font-bold text-primary">{s.yearsOfService}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">Years of Service</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Since {fmt(s.startDate)}</p>
                </Card>
              );
            })}
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">#</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Employee</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground hidden sm:table-cell">Department</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground hidden md:table-cell">Start Date</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Years</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((s, i) => (
                  <tr key={s.id} className="border-t border-border/50 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar name={s.name} photo={s.profilePhoto} size="sm" />
                        <div>
                          <p className="font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground sm:hidden">{s.department ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{s.department ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">{fmt(s.startDate)}</td>
                    <td className="px-4 py-2.5 text-right font-bold">{s.yearsOfService}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "longest" && (
        <div className="space-y-6">
          {topEmployee && (
            <Card className="p-6 bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar name={topEmployee.name} photo={topEmployee.profilePhoto} size="lg" />
                  <Crown className="w-5 h-5 text-amber-600 absolute -top-2 -right-2" />
                </div>
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wide font-semibold text-amber-600 mb-0.5">Longest Serving Staff Member</p>
                  <p className="text-xl font-bold">{topEmployee.name}</p>
                  <p className="text-sm text-muted-foreground">{topEmployee.jobTitle ?? "—"} · {topEmployee.department ?? "—"}{topEmployee.site ? ` · ${topEmployee.site}` : ""}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-amber-600">{topEmployee.yearsOfService}</p>
                  <p className="text-xs text-amber-600 font-medium uppercase">Years of Service</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Since {fmt(topEmployee.startDate)}</p>
                </div>
              </div>
            </Card>
          )}

          <h3 className="text-lg font-bold flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-600" /> Service Categories
          </h3>

          <div className="space-y-4">
            {milestoneGroups.map(group => {
              const members = longestServing.filter(s => {
                if (group.max !== undefined) return s.yearsOfService >= group.min && s.yearsOfService <= group.max;
                return s.yearsOfService >= group.min;
              });
              if (members.length === 0) return null;
              return (
                <Card key={group.label} className="overflow-hidden">
                  <div className={`bg-gradient-to-r ${group.color} px-4 py-2.5 text-white flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      {group.icon}
                      <span className="font-bold text-sm">{group.label}</span>
                    </div>
                    <span className="text-sm font-medium bg-white/20 px-2.5 py-0.5 rounded-full">{members.length} {members.length === 1 ? "member" : "members"}</span>
                  </div>
                  <div className="divide-y divide-border/50">
                    {members.map(s => (
                      <div key={s.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30">
                        <div className="flex items-center gap-3">
                          <Avatar name={s.name} photo={s.profilePhoto} />
                          <div>
                            <p className="font-semibold text-sm">{s.name}</p>
                            <p className="text-xs text-muted-foreground">{s.department ?? "—"}{s.jobTitle ? ` · ${s.jobTitle}` : ""}{s.site ? ` · ${s.site}` : ""}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm">{pluralize(s.yearsOfService, "year")}</p>
                          <p className="text-xs text-muted-foreground">Since {fmt(s.startDate)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
