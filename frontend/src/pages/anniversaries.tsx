import { useState, useEffect } from "react";
import { PageHeader, Card, Button, Input, Label } from "@/components/shared";
import {
  Award, Trophy, Crown, Medal, Filter, ArrowUp, ArrowDown, Cake, Star, Users, Calendar,
  Heart, Bell, Plus, X, Trash2, Edit2, Gift, PartyPopper, Clock, Repeat, AlertCircle,
} from "lucide-react";
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

interface BirthdayUser {
  id: number;
  name: string;
  department: string | null;
  jobTitle: string | null;
  dateOfBirth: string;
  profilePhoto: string | null;
  site: string | null;
  age: number;
  turningAge: number;
  nextBirthday: string;
  daysUntilBirthday: number;
  isToday: boolean;
}

interface WeddingUser {
  id: number;
  name: string;
  department: string | null;
  jobTitle: string | null;
  weddingDate: string;
  spouseName: string | null;
  profilePhoto: string | null;
  site: string | null;
  yearsMarried: number;
  nextAnniversary: string;
  daysUntilAnniversary: number;
  isToday: boolean;
}

interface Reminder {
  id: number;
  title: string;
  reminderType: string;
  reminderDate: string;
  recurring: boolean;
  notes: string | null;
  userId: number | null;
  userName: string | null;
  userDepartment: string | null;
  userJobTitle: string | null;
  userProfilePhoto: string | null;
  nextDate: string;
  daysUntil: number;
  isToday: boolean;
}

type TabType = "work" | "birthdays" | "weddings" | "reminders";
type WorkSubTab = "dashboard" | "leaderboard" | "longest";

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

function DaysUntilBadge({ days }: { days: number }) {
  const cls = days === 0
    ? "bg-green-100 text-green-700 border-green-200"
    : days <= 3
    ? "bg-blue-100 text-blue-700 border-blue-200"
    : days <= 7
    ? "bg-amber-100 text-amber-700 border-amber-200"
    : "bg-gray-100 text-gray-700 border-gray-200";
  const text = days === 0 ? "Today!" : days === 1 ? "Tomorrow" : `In ${days} days`;
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}>{text}</span>;
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <Card className="p-8 text-center">
      <Icon className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </Card>
  );
}

const REMINDER_TYPES = [
  { value: "birthday", label: "Birthday" },
  { value: "wedding_anniversary", label: "Wedding Anniversary" },
  { value: "work_anniversary", label: "Work Anniversary" },
  { value: "probation_end", label: "Probation End" },
  { value: "contract_renewal", label: "Contract Renewal" },
  { value: "certification_expiry", label: "Certification Expiry" },
  { value: "visa_expiry", label: "Visa/Permit Expiry" },
  { value: "training_due", label: "Training Due" },
  { value: "other", label: "Other" },
];

export default function Anniversaries() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("work");
  const [workSubTab, setWorkSubTab] = useState<WorkSubTab>("dashboard");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [leaderboardSort, setLeaderboardSort] = useState<"asc" | "desc">("desc");

  const [staff, setStaff] = useState<AnniversaryUser[]>([]);
  const [birthdays, setBirthdays] = useState<BirthdayUser[]>([]);
  const [weddings, setWeddings] = useState<WeddingUser[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: number; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showReminderForm, setShowReminderForm] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [reminderForm, setReminderForm] = useState({ title: "", reminderType: "other", reminderDate: "", recurring: true, notes: "", userId: "" });

  async function loadData() {
    try {
      const [aRes, bRes, wRes, rRes, uRes] = await Promise.all([
        apiFetch("/api/anniversaries"),
        apiFetch("/api/birthdays"),
        apiFetch("/api/weddings"),
        apiFetch("/api/reminders"),
        apiFetch("/api/users"),
      ]);
      if (aRes.ok) setStaff(await aRes.json());
      if (bRes.ok) setBirthdays(await bRes.json());
      if (wRes.ok) setWeddings(await wRes.json());
      if (rRes.ok) setReminders(await rRes.json());
      if (uRes.ok) {
        const users = await uRes.json();
        setAllUsers(users.map((u: any) => ({ id: u.id, name: u.name })));
      }
    } catch {}
    setIsLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  const allDepartments = [...new Set([
    ...staff.map(s => s.department),
    ...birthdays.map(b => b.department),
    ...weddings.map(w => w.department),
  ].filter(Boolean))] as string[];

  const filtered = departmentFilter === "all" ? staff : staff.filter(s => s.department === departmentFilter);
  const filteredBirthdays = departmentFilter === "all" ? birthdays : birthdays.filter(b => b.department === departmentFilter);
  const filteredWeddings = departmentFilter === "all" ? weddings : weddings.filter(w => w.department === departmentFilter);

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

  const todayBirthdays = filteredBirthdays.filter(b => b.isToday);
  const upcomingBirthdays30 = filteredBirthdays.filter(b => !b.isToday && b.daysUntilBirthday <= 30 && b.daysUntilBirthday > 0)
    .sort((a, b) => a.daysUntilBirthday - b.daysUntilBirthday);

  const todayWeddings = filteredWeddings.filter(w => w.isToday);
  const upcomingWeddings30 = filteredWeddings.filter(w => !w.isToday && w.daysUntilAnniversary <= 30 && w.daysUntilAnniversary > 0)
    .sort((a, b) => a.daysUntilAnniversary - b.daysUntilAnniversary);

  const todayReminders = reminders.filter(r => r.isToday);
  const upcomingReminders30 = reminders.filter(r => !r.isToday && r.daysUntil <= 30 && r.daysUntil > 0)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  function openReminderForm(r?: Reminder) {
    if (r) {
      setEditingReminder(r);
      setReminderForm({
        title: r.title,
        reminderType: r.reminderType,
        reminderDate: r.reminderDate,
        recurring: r.recurring,
        notes: r.notes || "",
        userId: r.userId ? String(r.userId) : "",
      });
    } else {
      setEditingReminder(null);
      setReminderForm({ title: "", reminderType: "other", reminderDate: "", recurring: true, notes: "", userId: "" });
    }
    setShowReminderForm(true);
  }

  async function saveReminder() {
    const body = {
      ...reminderForm,
      userId: reminderForm.userId ? Number(reminderForm.userId) : null,
    };
    if (editingReminder) {
      await apiFetch(`/api/reminders/${editingReminder.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } else {
      await apiFetch("/api/reminders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    setShowReminderForm(false);
    loadData();
  }

  async function deleteReminder(id: number) {
    if (!confirm("Delete this reminder?")) return;
    await apiFetch(`/api/reminders/${id}`, { method: "DELETE" });
    loadData();
  }

  const tabs: { key: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "work", label: "Work Anniversaries", icon: <Award className="w-4 h-4" />, count: todayAnniversaries.length },
    { key: "birthdays", label: "Birthdays", icon: <Cake className="w-4 h-4" />, count: todayBirthdays.length },
    { key: "weddings", label: "Weddings", icon: <Heart className="w-4 h-4" />, count: todayWeddings.length },
    { key: "reminders", label: "Reminders", icon: <Bell className="w-4 h-4" />, count: todayReminders.length },
  ];

  const workSubTabs: { key: WorkSubTab; label: string; icon: React.ReactNode }[] = [
    { key: "dashboard", label: "Overview", icon: <Calendar className="w-3.5 h-3.5" /> },
    { key: "leaderboard", label: "Leaderboard", icon: <Trophy className="w-3.5 h-3.5" /> },
    { key: "longest", label: "Longest Serving", icon: <Crown className="w-3.5 h-3.5" /> },
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
      <PageHeader title="Anniversaries & Reminders" description="Celebrate milestones — birthdays, weddings, work anniversaries, and custom reminders." />

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl w-fit flex-wrap">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative ${activeTab === t.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.icon}{t.label}
              {(t.count ?? 0) > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${activeTab === t.key ? "bg-white/20 text-primary-foreground" : "bg-green-500 text-white"}`}>
                  {t.count}
                </span>
              )}
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
            {allDepartments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {activeTab === "work" && (
        <div className="space-y-6">
          <div className="flex gap-1 bg-muted/50 p-1 rounded-lg w-fit">
            {workSubTabs.map(t => (
              <button
                key={t.key}
                onClick={() => setWorkSubTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${workSubTab === t.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {workSubTab === "dashboard" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="p-4 text-center">
                  <Users className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold">{filtered.length}</p>
                  <p className="text-xs text-muted-foreground">Total Staff</p>
                </Card>
                <Card className="p-4 text-center">
                  <PartyPopper className="w-6 h-6 text-pink-600 mx-auto mb-1" />
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
                    <PartyPopper className="w-5 h-5 text-pink-600" /> Today's Work Anniversaries
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
                            <DaysUntilBadge days={s.daysUntilAnniversary} />
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {todayAnniversaries.length === 0 && upcoming30.length === 0 && (
                <EmptyState icon={Award} message="No work anniversaries coming up in the next 30 days" />
              )}
            </div>
          )}

          {workSubTab === "leaderboard" && (
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
                  const colors = ["from-yellow-400 to-amber-500", "from-gray-300 to-gray-400", "from-amber-600 to-amber-700"];
                  const icons = [<Crown className="w-6 h-6 text-yellow-600" />, <Medal className="w-6 h-6 text-gray-500" />, <Medal className="w-6 h-6 text-amber-700" />];
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

              <div className="rounded-xl border border-border overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
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

          {workSubTab === "longest" && (
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
      )}

      {activeTab === "birthdays" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4 text-center">
              <Cake className="w-6 h-6 text-pink-600 mx-auto mb-1" />
              <p className="text-2xl font-bold">{todayBirthdays.length}</p>
              <p className="text-xs text-muted-foreground">Birthdays Today</p>
            </Card>
            <Card className="p-4 text-center">
              <Calendar className="w-6 h-6 text-blue-600 mx-auto mb-1" />
              <p className="text-2xl font-bold">{upcomingBirthdays30.length}</p>
              <p className="text-xs text-muted-foreground">Next 30 Days</p>
            </Card>
            <Card className="p-4 text-center">
              <Gift className="w-6 h-6 text-purple-600 mx-auto mb-1" />
              <p className="text-2xl font-bold">{filteredBirthdays.filter(b => { const m = new Date(b.nextBirthday).getMonth(); return m === new Date().getMonth(); }).length}</p>
              <p className="text-xs text-muted-foreground">This Month</p>
            </Card>
            <Card className="p-4 text-center">
              <Users className="w-6 h-6 text-green-600 mx-auto mb-1" />
              <p className="text-2xl font-bold">{filteredBirthdays.length}</p>
              <p className="text-xs text-muted-foreground">Total with DOB</p>
            </Card>
          </div>

          {todayBirthdays.length > 0 && (
            <div>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <PartyPopper className="w-5 h-5 text-pink-600" /> Happy Birthday!
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {todayBirthdays.map(b => (
                  <Card key={b.id} className="p-4 border-pink-200 bg-gradient-to-br from-pink-50 to-purple-50">
                    <div className="flex items-center gap-3">
                      <Avatar name={b.name} photo={b.profilePhoto} size="lg" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{b.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{b.jobTitle ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{b.department ?? "—"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-2xl font-bold text-pink-600">{b.age}</p>
                        <p className="text-[10px] text-pink-600 font-medium uppercase">Years Old</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {upcomingBirthdays30.length > 0 && (
            <div>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Cake className="w-5 h-5 text-amber-600" /> Upcoming Birthdays (Next 30 Days)
              </h3>
              <div className="space-y-2">
                {upcomingBirthdays30.map(b => (
                  <Card key={b.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar name={b.name} photo={b.profilePhoto} />
                        <div>
                          <p className="font-semibold text-sm">{b.name}</p>
                          <p className="text-xs text-muted-foreground">{b.department ?? "—"} {b.jobTitle ? `· ${b.jobTitle}` : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <p className="text-xs text-muted-foreground">Born {fmt(b.dateOfBirth)}</p>
                          <p className="text-xs font-medium">Turning {b.turningAge} on {fmt(b.nextBirthday)}</p>
                        </div>
                        <DaysUntilBadge days={b.daysUntilBirthday} />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {todayBirthdays.length === 0 && upcomingBirthdays30.length === 0 && (
            <EmptyState icon={Cake} message="No birthdays coming up in the next 30 days" />
          )}
        </div>
      )}

      {activeTab === "weddings" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Card className="p-4 text-center">
              <Heart className="w-6 h-6 text-red-500 mx-auto mb-1" />
              <p className="text-2xl font-bold">{todayWeddings.length}</p>
              <p className="text-xs text-muted-foreground">Anniversaries Today</p>
            </Card>
            <Card className="p-4 text-center">
              <Calendar className="w-6 h-6 text-blue-600 mx-auto mb-1" />
              <p className="text-2xl font-bold">{upcomingWeddings30.length}</p>
              <p className="text-xs text-muted-foreground">Next 30 Days</p>
            </Card>
            <Card className="p-4 text-center">
              <Users className="w-6 h-6 text-green-600 mx-auto mb-1" />
              <p className="text-2xl font-bold">{filteredWeddings.length}</p>
              <p className="text-xs text-muted-foreground">Total Recorded</p>
            </Card>
          </div>

          {todayWeddings.length > 0 && (
            <div>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-500" /> Happy Wedding Anniversary!
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {todayWeddings.map(w => (
                  <Card key={w.id} className="p-4 border-red-200 bg-gradient-to-br from-red-50 to-pink-50">
                    <div className="flex items-center gap-3">
                      <Avatar name={w.name} photo={w.profilePhoto} size="lg" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{w.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{w.jobTitle ?? "—"} · {w.department ?? "—"}</p>
                        {w.spouseName && <p className="text-xs text-red-600">Married to {w.spouseName}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-2xl font-bold text-red-500">{w.yearsMarried}</p>
                        <p className="text-[10px] text-red-500 font-medium uppercase">Years</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {upcomingWeddings30.length > 0 && (
            <div>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Heart className="w-5 h-5 text-amber-600" /> Upcoming Wedding Anniversaries (Next 30 Days)
              </h3>
              <div className="space-y-2">
                {upcomingWeddings30.map(w => (
                  <Card key={w.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar name={w.name} photo={w.profilePhoto} />
                        <div>
                          <p className="font-semibold text-sm">{w.name}</p>
                          <p className="text-xs text-muted-foreground">{w.department ?? "—"} {w.spouseName ? `· Married to ${w.spouseName}` : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <p className="text-xs text-muted-foreground">Married {fmt(w.weddingDate)}</p>
                          <p className="text-xs font-medium">{pluralize(w.yearsMarried + 1, "year")} on {fmt(w.nextAnniversary)}</p>
                        </div>
                        <DaysUntilBadge days={w.daysUntilAnniversary} />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {todayWeddings.length === 0 && upcomingWeddings30.length === 0 && (
            <EmptyState icon={Heart} message="No wedding anniversaries coming up in the next 30 days. Add wedding dates in Staff profiles." />
          )}
        </div>
      )}

      {activeTab === "reminders" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-600" /> Custom Reminders
            </h3>
            <Button onClick={() => openReminderForm()} size="sm">
              <Plus className="w-4 h-4 mr-1" /> New Reminder
            </Button>
          </div>

          {todayReminders.length > 0 && (
            <div>
              <h4 className="text-sm font-bold mb-2 flex items-center gap-2 text-green-700">
                <AlertCircle className="w-4 h-4" /> Due Today
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {todayReminders.map(r => (
                  <Card key={r.id} className="p-4 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {r.userName ? <Avatar name={r.userName} photo={r.userProfilePhoto} /> : <Bell className="w-10 h-10 text-green-600 p-2 bg-green-100 rounded-full shrink-0" />}
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">{r.title}</p>
                          {r.userName && <p className="text-xs text-muted-foreground">{r.userName} · {r.userDepartment ?? "—"}</p>}
                          <p className="text-xs text-green-700 mt-0.5">{REMINDER_TYPES.find(t => t.value === r.reminderType)?.label ?? r.reminderType}</p>
                          {r.notes && <p className="text-xs text-muted-foreground mt-1">{r.notes}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        {r.recurring && <Repeat className="w-3.5 h-3.5 text-muted-foreground" title="Recurring" />}
                        <button onClick={() => openReminderForm(r)} className="p-1 hover:bg-muted rounded"><Edit2 className="w-3.5 h-3.5 text-muted-foreground" /></button>
                        <button onClick={() => deleteReminder(r.id)} className="p-1 hover:bg-destructive/10 rounded"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {upcomingReminders30.length > 0 && (
            <div>
              <h4 className="text-sm font-bold mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" /> Upcoming (Next 30 Days)
              </h4>
              <div className="space-y-2">
                {upcomingReminders30.map(r => (
                  <Card key={r.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {r.userName ? <Avatar name={r.userName} photo={r.userProfilePhoto} size="sm" /> : <Bell className="w-8 h-8 text-blue-600 p-1.5 bg-blue-100 rounded-full shrink-0" />}
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{r.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.userName ?? "General"} · {REMINDER_TYPES.find(t => t.value === r.reminderType)?.label ?? r.reminderType}
                            {r.recurring && " · Recurring"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <DaysUntilBadge days={r.daysUntil} />
                        <button onClick={() => openReminderForm(r)} className="p-1 hover:bg-muted rounded"><Edit2 className="w-3.5 h-3.5 text-muted-foreground" /></button>
                        <button onClick={() => deleteReminder(r.id)} className="p-1 hover:bg-destructive/10 rounded"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {reminders.filter(r => r.daysUntil > 30).length > 0 && (
            <div>
              <h4 className="text-sm font-bold mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" /> Later
              </h4>
              <div className="space-y-2">
                {reminders.filter(r => r.daysUntil > 30).map(r => (
                  <Card key={r.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {r.userName ? <Avatar name={r.userName} photo={r.userProfilePhoto} size="sm" /> : <Bell className="w-8 h-8 text-gray-400 p-1.5 bg-gray-100 rounded-full shrink-0" />}
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{r.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.userName ?? "General"} · {fmt(r.nextDate)}
                            {r.recurring && " · Recurring"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{r.daysUntil} days</span>
                        <button onClick={() => openReminderForm(r)} className="p-1 hover:bg-muted rounded"><Edit2 className="w-3.5 h-3.5 text-muted-foreground" /></button>
                        <button onClick={() => deleteReminder(r.id)} className="p-1 hover:bg-destructive/10 rounded"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {reminders.length === 0 && (
            <EmptyState icon={Bell} message="No reminders yet. Click 'New Reminder' to create one." />
          )}
        </div>
      )}

      {showReminderForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">{editingReminder ? "Edit Reminder" : "New Reminder"}</h3>
              <button onClick={() => setShowReminderForm(false)} className="p-1 hover:bg-muted rounded"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Title</Label>
                <Input value={reminderForm.title} onChange={e => setReminderForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Contract renewal for John" />
              </div>
              <div>
                <Label className="text-sm font-medium">Type</Label>
                <select
                  value={reminderForm.reminderType}
                  onChange={e => setReminderForm(p => ({ ...p, reminderType: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                >
                  {REMINDER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-sm font-medium">Date</Label>
                <Input type="date" value={reminderForm.reminderDate} onChange={e => setReminderForm(p => ({ ...p, reminderDate: e.target.value }))} />
              </div>
              <div>
                <Label className="text-sm font-medium">Link to Employee (optional)</Label>
                <select
                  value={reminderForm.userId}
                  onChange={e => setReminderForm(p => ({ ...p, userId: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                >
                  <option value="">None (general reminder)</option>
                  {allUsers.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="recurring" checked={reminderForm.recurring} onChange={e => setReminderForm(p => ({ ...p, recurring: e.target.checked }))} className="rounded" />
                <label htmlFor="recurring" className="text-sm">Recurring (repeats annually)</label>
              </div>
              <div>
                <Label className="text-sm font-medium">Notes (optional)</Label>
                <textarea
                  value={reminderForm.notes}
                  onChange={e => setReminderForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Any additional notes..."
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none h-20"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowReminderForm(false)}>Cancel</Button>
              <Button onClick={saveReminder} disabled={!reminderForm.title || !reminderForm.reminderDate}>
                {editingReminder ? "Update" : "Create"} Reminder
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
