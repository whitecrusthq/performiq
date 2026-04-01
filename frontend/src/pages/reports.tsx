import { useState, useEffect, useCallback } from "react";
import { PageHeader, Card } from "@/components/shared";
import {
  BarChart3, Download, Users, CheckCircle2, TrendingUp, FileSpreadsheet,
  Building2, ChevronDown, Clock, ClipboardCheck, Calendar, Timer,
  AlertCircle, Filter,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  completed: "#22c55e",
  manager_review: "#3b82f6",
  self_review: "#f59e0b",
  pending: "#94a3b8",
  pending_approval: "#8b5cf6",
};
const PIE_COLORS = ["#22c55e", "#f59e0b", "#3b82f6", "#ef4444", "#94a3b8"];
const TS_STATUS_COLORS: Record<string, string> = {
  approved: "#22c55e",
  submitted: "#3b82f6",
  rejected: "#ef4444",
  draft: "#94a3b8",
};

type EmployeeRow = {
  id: number; name: string; jobTitle: string | null; role: string;
  totalAppraisals: number; completed: number; completionRate: number; avgScore: number | null
};
type ReportData = {
  departments: string[];
  selectedDepartment: string | null;
  workforce: { total: number; roleBreakdown: Record<string, number>; deptBreakdown: Record<string, number> };
  appraisals: { total: number; completed: number; completionRate: number; avgOverallScore: number | null; statusBreakdown: Record<string, number> };
  avgScoreByDept: { department: string; avgScore: number; count: number }[];
  cycleStats: { id: number; name: string; status: string; total: number; completed: number; completionRate: number; avgScore: number | null }[];
  criteriaStats: { id: number; name: string; category: string; avgSelfScore: number | null; avgManagerScore: number | null }[];
  ratingDistribution: { label: string; count: number }[];
  employeeList: EmployeeRow[];
};

type AttRow = {
  userId: number; name: string; email: string; department: string;
  daysPresent: number; totalMinutes: number; totalHours: number;
  avgMinutesPerDay: number; avgHoursPerDay: number;
};
type AttData = {
  summary: { totalRecords: number; uniqueEmployees: number; totalDays: number; totalMinutes: number; totalHours: number; avgHoursPerDay: number };
  rows: AttRow[];
};

type TsRow = {
  id: number; userId: number; name: string; email: string; department: string;
  weekStart: string; weekEnd: string; totalMinutes: number; totalHours: number;
  status: string; submittedAt: string | null; approvedAt: string | null;
};
type TsData = {
  summary: { total: number; approved: number; submitted: number; rejected: number; draft: number; totalMinutes: number; totalHours: number };
  rows: TsRow[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    approved: "bg-green-100 text-green-700",
    submitted: "bg-blue-100 text-blue-700",
    rejected: "bg-red-100 text-red-700",
    draft: "bg-slate-100 text-slate-600",
  };
  return `px-2 py-0.5 rounded-full text-xs font-medium capitalize ${map[status] ?? "bg-slate-100 text-slate-600"}`;
}

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

// ─── Tab: Attendance Report ───────────────────────────────────────────────────

function AttendanceTab() {
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = today.slice(0, 8) + "01";
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<AttData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/reports/attendance-summary?${params}`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : Promise.reject("Failed"))
      .then(setData)
      .catch(() => setError("Could not load attendance report."))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  // ── Excel export ──
  const exportExcel = async () => {
    if (!data) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const summaryRows = [
      ["PerformIQ — Attendance Report"],
      [`Period: ${from} to ${to}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      ["Metric", "Value"],
      ["Total Records", data.summary.totalRecords],
      ["Unique Employees", data.summary.uniqueEmployees],
      ["Total Days Logged", data.summary.totalDays],
      ["Total Hours", data.summary.totalHours],
      ["Avg Hours/Day", data.summary.avgHoursPerDay],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");
    const detailRows = [
      ["Employee", "Email", "Department", "Days Present", "Total Hours", "Avg Hours/Day"],
      ...data.rows.map(r => [r.name, r.email, r.department, r.daysPresent, r.totalHours, r.avgHoursPerDay]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailRows), "Attendance Detail");
    XLSX.writeFile(wb, `PerformIQ_Attendance_${from}_${to}.xlsx`);
  };

  // ── PDF export ──
  const exportPDF = async () => {
    if (!data) return;
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF();
    let y = 18;
    doc.setFontSize(18); doc.setTextColor(59, 130, 246);
    doc.text("PerformIQ — Attendance Report", 14, y); y += 7;
    doc.setFontSize(11); doc.setTextColor(80, 80, 80);
    doc.text(`Period: ${from} to ${to}`, 14, y); y += 5;
    doc.setFontSize(9); doc.setTextColor(140, 140, 140);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y); y += 8;
    doc.setFontSize(13); doc.setTextColor(30, 30, 30);
    doc.text("Summary", 14, y); y += 4;
    autoTable(doc, {
      startY: y,
      head: [["Metric", "Value"]],
      body: [
        ["Total Records", data.summary.totalRecords],
        ["Unique Employees", data.summary.uniqueEmployees],
        ["Total Days Logged", data.summary.totalDays],
        ["Total Hours", data.summary.totalHours],
        ["Avg Hours/Day", data.summary.avgHoursPerDay],
      ],
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 8;
    if (y > 220) { doc.addPage(); y = 18; }
    doc.setFontSize(13); doc.setTextColor(30, 30, 30);
    doc.text("Attendance by Employee", 14, y); y += 4;
    autoTable(doc, {
      startY: y,
      head: [["Employee", "Department", "Days Present", "Total Hours", "Avg Hours/Day"]],
      body: data.rows.map(r => [r.name, r.department, r.daysPresent, r.totalHours, r.avgHoursPerDay]),
      theme: "striped",
    });
    doc.save(`PerformIQ_Attendance_${from}_${to}.pdf`);
  };

  const deptData = data ? Object.entries(
    data.rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.department] = (acc[r.department] ?? 0) + r.totalHours;
      return acc;
    }, {})
  ).map(([dept, hours]) => ({ dept, hours })).sort((a, b) => b.hours - a.hours) : [];

  return (
    <div>
      {/* Filters + Export */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="text-sm bg-transparent border-none outline-none" />
          <span className="text-muted-foreground text-sm">–</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="text-sm bg-transparent border-none outline-none" />
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={exportExcel} disabled={!data}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
            <FileSpreadsheet className="w-4 h-4 text-green-600" /> Excel
          </button>
          <button onClick={exportPDF} disabled={!data}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
            <Download className="w-4 h-4 text-red-500" /> PDF
          </button>
        </div>
      </div>

      {loading && <div className="flex items-center justify-center h-48 text-muted-foreground">Loading…</div>}
      {error && <div className="flex items-center gap-2 text-destructive p-4"><AlertCircle className="w-4 h-4" />{error}</div>}
      {!loading && !error && data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Employees", value: data.summary.uniqueEmployees, icon: Users, color: "text-blue-500 bg-blue-50" },
              { label: "Total Days Logged", value: data.summary.totalDays, icon: Clock, color: "text-purple-500 bg-purple-50" },
              { label: "Total Hours", value: `${data.summary.totalHours}h`, icon: Timer, color: "text-green-500 bg-green-50" },
              { label: "Avg Hours/Day", value: `${data.summary.avgHoursPerDay}h`, icon: TrendingUp, color: "text-amber-500 bg-amber-50" },
            ].map(card => (
              <Card key={card.label} className="p-5 flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${card.color}`}>
                  <card.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{card.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
                </div>
              </Card>
            ))}
          </div>

          {/* Chart + Table side by side on large screens */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-4">Hours by Department</h3>
              {deptData.length === 0
                ? <p className="text-muted-foreground text-sm">No data for this period.</p>
                : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={deptData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="dept" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip formatter={(v: any) => [`${v}h`, "Total Hours"]} />
                      <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-4">Hours Distribution</h3>
              {data.rows.length === 0
                ? <p className="text-muted-foreground text-sm">No records found.</p>
                : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={deptData} dataKey="hours" nameKey="dept" cx="50%" cy="50%" outerRadius={80}>
                        {deptData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => [`${v}h`]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
            </Card>
          </div>

          {/* Detail Table */}
          <Card className="p-6">
            <h3 className="font-semibold text-foreground mb-4">Employee Attendance Detail</h3>
            {data.rows.length === 0
              ? <p className="text-muted-foreground text-sm">No attendance records for this period.</p>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Employee</th>
                        <th className="pb-2 pr-4 font-medium hidden sm:table-cell">Department</th>
                        <th className="pb-2 pr-4 font-medium text-right">Days</th>
                        <th className="pb-2 pr-4 font-medium text-right">Total Hours</th>
                        <th className="pb-2 font-medium text-right">Avg Hours/Day</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.rows.map(r => (
                        <tr key={r.userId} className="hover:bg-muted/30">
                          <td className="py-2.5 pr-4">
                            <p className="font-medium">{r.name}</p>
                            <p className="text-xs text-muted-foreground hidden sm:block">{r.email}</p>
                          </td>
                          <td className="py-2.5 pr-4 text-muted-foreground hidden sm:table-cell">{r.department}</td>
                          <td className="py-2.5 pr-4 text-right font-medium">{r.daysPresent}</td>
                          <td className="py-2.5 pr-4 text-right">
                            <span className="font-semibold text-blue-600">{r.totalHours}h</span>
                          </td>
                          <td className="py-2.5 text-right">
                            <span className={`font-semibold ${r.avgHoursPerDay >= 8 ? "text-green-600" : r.avgHoursPerDay >= 6 ? "text-amber-600" : "text-red-500"}`}>
                              {r.avgHoursPerDay}h
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Tab: Timesheets Report ───────────────────────────────────────────────────

function TimesheetsTab() {
  const today = new Date().toISOString().split("T")[0];
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [from, setFrom] = useState(threeMonthsAgo);
  const [to, setTo] = useState(today);
  const [statusFilter, setStatusFilter] = useState("");
  const [data, setData] = useState<TsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/reports/timesheets-summary?${params}`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : Promise.reject("Failed"))
      .then(setData)
      .catch(() => setError("Could not load timesheets report."))
      .finally(() => setLoading(false));
  }, [from, to, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // ── Excel export ──
  const exportExcel = async () => {
    if (!data) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const summaryRows = [
      ["PerformIQ — Timesheets Report"],
      [`Period: ${from} to ${to}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      ["Metric", "Value"],
      ["Total Timesheets", data.summary.total],
      ["Approved", data.summary.approved],
      ["Submitted (Pending)", data.summary.submitted],
      ["Rejected", data.summary.rejected],
      ["Draft", data.summary.draft],
      ["Total Hours", data.summary.totalHours],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");
    const detailRows = [
      ["Employee", "Email", "Department", "Week Start", "Week End", "Total Hours", "Status"],
      ...data.rows.map(r => [r.name, r.email, r.department, r.weekStart, r.weekEnd, r.totalHours, r.status]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailRows), "Timesheets Detail");
    XLSX.writeFile(wb, `PerformIQ_Timesheets_${from}_${to}.xlsx`);
  };

  // ── PDF export ──
  const exportPDF = async () => {
    if (!data) return;
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF();
    let y = 18;
    doc.setFontSize(18); doc.setTextColor(59, 130, 246);
    doc.text("PerformIQ — Timesheets Report", 14, y); y += 7;
    doc.setFontSize(11); doc.setTextColor(80, 80, 80);
    doc.text(`Period: ${from} to ${to}`, 14, y); y += 5;
    doc.setFontSize(9); doc.setTextColor(140, 140, 140);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y); y += 8;
    doc.setFontSize(13); doc.setTextColor(30, 30, 30);
    doc.text("Summary", 14, y); y += 4;
    autoTable(doc, {
      startY: y,
      head: [["Metric", "Value"]],
      body: [
        ["Total Timesheets", data.summary.total],
        ["Approved", data.summary.approved],
        ["Submitted (Pending)", data.summary.submitted],
        ["Rejected", data.summary.rejected],
        ["Draft", data.summary.draft],
        ["Total Hours", data.summary.totalHours],
      ],
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 8;
    if (y > 220) { doc.addPage(); y = 18; }
    doc.setFontSize(13); doc.setTextColor(30, 30, 30);
    doc.text("Timesheets Detail", 14, y); y += 4;
    autoTable(doc, {
      startY: y,
      head: [["Employee", "Department", "Week Start", "Week End", "Hours", "Status"]],
      body: data.rows.map(r => [r.name, r.department, r.weekStart, r.weekEnd, `${r.totalHours}h`, r.status]),
      theme: "striped",
    });
    doc.save(`PerformIQ_Timesheets_${from}_${to}.pdf`);
  };

  const statusChartData = data
    ? [
        { name: "Approved", value: data.summary.approved, color: "#22c55e" },
        { name: "Submitted", value: data.summary.submitted, color: "#3b82f6" },
        { name: "Rejected", value: data.summary.rejected, color: "#ef4444" },
        { name: "Draft", value: data.summary.draft, color: "#94a3b8" },
      ].filter(d => d.value > 0)
    : [];

  const deptHours = data ? Object.entries(
    data.rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.department] = (acc[r.department] ?? 0) + r.totalHours;
      return acc;
    }, {})
  ).map(([dept, hours]) => ({ dept, hours })).sort((a, b) => b.hours - a.hours) : [];

  return (
    <div>
      {/* Filters + Export */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="text-sm bg-transparent border-none outline-none" />
          <span className="text-muted-foreground text-sm">–</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="text-sm bg-transparent border-none outline-none" />
        </div>

        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="text-sm bg-transparent border-none outline-none cursor-pointer">
            <option value="">All Statuses</option>
            <option value="approved">Approved</option>
            <option value="submitted">Submitted</option>
            <option value="rejected">Rejected</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        <div className="ml-auto flex gap-2">
          <button onClick={exportExcel} disabled={!data}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
            <FileSpreadsheet className="w-4 h-4 text-green-600" /> Excel
          </button>
          <button onClick={exportPDF} disabled={!data}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
            <Download className="w-4 h-4 text-red-500" /> PDF
          </button>
        </div>
      </div>

      {loading && <div className="flex items-center justify-center h-48 text-muted-foreground">Loading…</div>}
      {error && <div className="flex items-center gap-2 text-destructive p-4"><AlertCircle className="w-4 h-4" />{error}</div>}
      {!loading && !error && data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total Timesheets", value: data.summary.total, icon: ClipboardCheck, color: "text-blue-500 bg-blue-50" },
              { label: "Approved", value: data.summary.approved, icon: CheckCircle2, color: "text-green-500 bg-green-50" },
              { label: "Pending Review", value: data.summary.submitted, icon: Clock, color: "text-amber-500 bg-amber-50" },
              { label: "Total Hours", value: `${data.summary.totalHours}h`, icon: Timer, color: "text-purple-500 bg-purple-50" },
            ].map(card => (
              <Card key={card.label} className="p-5 flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${card.color}`}>
                  <card.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{card.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
                </div>
              </Card>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-4">Status Breakdown</h3>
              {statusChartData.length === 0
                ? <p className="text-muted-foreground text-sm">No timesheets in this period.</p>
                : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={statusChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                        {statusChartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-4">Hours by Department</h3>
              {deptHours.length === 0
                ? <p className="text-muted-foreground text-sm">No data for this period.</p>
                : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={deptHours}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="dept" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip formatter={(v: any) => [`${v}h`, "Total Hours"]} />
                      <Bar dataKey="hours" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
            </Card>
          </div>

          {/* Detail Table */}
          <Card className="p-6">
            <h3 className="font-semibold text-foreground mb-4">Timesheets Detail
              {data.summary.total > 0 && <span className="ml-2 text-sm font-normal text-muted-foreground">({data.summary.total} records)</span>}
            </h3>
            {data.rows.length === 0
              ? <p className="text-muted-foreground text-sm">No timesheets found for the selected period and filters.</p>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Employee</th>
                        <th className="pb-2 pr-4 font-medium hidden sm:table-cell">Department</th>
                        <th className="pb-2 pr-4 font-medium">Week</th>
                        <th className="pb-2 pr-4 font-medium text-right">Hours</th>
                        <th className="pb-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.rows.map(r => (
                        <tr key={r.id} className="hover:bg-muted/30">
                          <td className="py-2.5 pr-4">
                            <p className="font-medium">{r.name}</p>
                            <p className="text-xs text-muted-foreground hidden sm:block">{r.email}</p>
                          </td>
                          <td className="py-2.5 pr-4 text-muted-foreground hidden sm:table-cell">{r.department}</td>
                          <td className="py-2.5 pr-4 text-muted-foreground text-xs">{r.weekStart} → {r.weekEnd}</td>
                          <td className="py-2.5 pr-4 text-right font-semibold text-purple-600">{fmtHours(r.totalMinutes)}</td>
                          <td className="py-2.5">
                            <span className={statusBadge(r.status)}>{r.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Tab: Appraisals Report (existing) ───────────────────────────────────────

function AppraisalsTab() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState<string>("");

  const fetchData = useCallback((dept: string) => {
    setLoading(true); setError(null);
    const url = dept ? `/api/reports?department=${encodeURIComponent(dept)}` : "/api/reports";
    fetch(url, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : Promise.reject("Failed to load"))
      .then(setData)
      .catch(() => setError("Could not load report data."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(""); }, [fetchData]);

  const handleDeptChange = (dept: string) => { setSelectedDept(dept); fetchData(dept); };
  const scopeLabel = selectedDept || "All Departments";

  const handleExportExcel = async () => {
    if (!data) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const summaryRows = [
      ["PerformIQ Performance Report"],
      [`Scope: ${scopeLabel}`],
      [`Generated: ${new Date().toLocaleDateString()}`],
      [],
      ["Metric", "Value"],
      ["Total Employees", data.workforce.total],
      ["Total Appraisals", data.appraisals.total],
      ["Completed", data.appraisals.completed],
      ["Completion Rate (%)", data.appraisals.completionRate],
      ["Average Score", data.appraisals.avgOverallScore ?? "N/A"],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");
    if (selectedDept && data.employeeList.length > 0) {
      const empRows = [
        [`Department: ${selectedDept}`, "", "", "", "", ""],
        ["Name", "Job Title", "Role", "Appraisals", "Completed", "Avg Score"],
        ...data.employeeList.map(e => [e.name, e.jobTitle ?? "", e.role, e.totalAppraisals, e.completed, e.avgScore ?? "N/A"]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(empRows), `${selectedDept.slice(0, 28)} Staff`);
    }
    const deptRows = [
      ["Department", "Avg Score", "Scored Appraisals"],
      ...data.avgScoreByDept.map(d => [d.department, d.avgScore, d.count]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(deptRows), "Dept Scores");
    const cycRows = [
      ["Cycle", "Status", "Total", "Completed", "Completion %", "Avg Score"],
      ...data.cycleStats.map(c => [c.name, c.status, c.total, c.completed, `${c.completionRate}%`, c.avgScore ?? "N/A"]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cycRows), "Cycles");
    const critRows = [
      ["Criterion", "Category", "Avg Self Score", "Avg Manager Score"],
      ...data.criteriaStats.map(c => [c.name, c.category, c.avgSelfScore ?? "N/A", c.avgManagerScore ?? "N/A"]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(critRows), "Criteria");
    const ratingRows = [["Rating Band", "Count"], ...data.ratingDistribution.map(r => [r.label, r.count])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ratingRows), "Rating Distribution");
    const fileName = selectedDept ? `PerformIQ_${selectedDept.replace(/\s+/g, "_")}_Report.xlsx` : "PerformIQ_Report.xlsx";
    XLSX.writeFile(wb, fileName);
  };

  const handleExportPDF = async () => {
    if (!data) return;
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF();
    let y = 18;
    doc.setFontSize(18); doc.setTextColor(59, 130, 246);
    doc.text("PerformIQ — Performance Report", 14, y); y += 7;
    doc.setFontSize(11); doc.setTextColor(80, 80, 80);
    doc.text(`Scope: ${scopeLabel}`, 14, y); y += 5;
    doc.setFontSize(9); doc.setTextColor(140, 140, 140);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y); y += 8;
    doc.setFontSize(13); doc.setTextColor(30, 30, 30);
    doc.text("Appraisal Summary", 14, y); y += 4;
    autoTable(doc, {
      startY: y,
      head: [["Metric", "Value"]],
      body: [
        ["Employees in scope", data.workforce.total],
        ["Total Appraisals", data.appraisals.total],
        ["Completed", data.appraisals.completed],
        ["Completion Rate", `${data.appraisals.completionRate}%`],
        ["Average Score", data.appraisals.avgOverallScore?.toFixed(2) ?? "N/A"],
      ],
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 8;
    if (selectedDept && data.employeeList.length > 0) {
      if (y > 220) { doc.addPage(); y = 18; }
      doc.setFontSize(13); doc.setTextColor(30, 30, 30);
      doc.text(`${selectedDept} — Staff Performance`, 14, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [["Name", "Job Title", "Role", "Appraisals", "Completed", "Completion", "Avg Score"]],
        body: data.employeeList.map(e => [e.name, e.jobTitle ?? "—", e.role, e.totalAppraisals, e.completed, `${e.completionRate}%`, e.avgScore?.toFixed(2) ?? "N/A"]),
        theme: "striped",
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }
    if (y > 220) { doc.addPage(); y = 18; }
    doc.setFontSize(13); doc.setTextColor(30, 30, 30);
    doc.text("Cycle Statistics", 14, y); y += 4;
    autoTable(doc, {
      startY: y,
      head: [["Cycle", "Status", "Total", "Completed", "Completion %", "Avg Score"]],
      body: data.cycleStats.map(c => [c.name, c.status, c.total, c.completed, `${c.completionRate}%`, c.avgScore?.toFixed(2) ?? "N/A"]),
      theme: "striped",
    });
    y = (doc as any).lastAutoTable.finalY + 8;
    if (!selectedDept && data.avgScoreByDept.length > 0) {
      if (y > 220) { doc.addPage(); y = 18; }
      doc.setFontSize(13); doc.setTextColor(30, 30, 30);
      doc.text("Average Score by Department", 14, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [["Department", "Avg Score", "Appraisals"]],
        body: data.avgScoreByDept.map(d => [d.department, d.avgScore.toFixed(2), d.count]),
        theme: "striped",
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }
    if (data.criteriaStats.some(c => c.avgSelfScore !== null || c.avgManagerScore !== null)) {
      if (y > 220) { doc.addPage(); y = 18; }
      doc.setFontSize(13); doc.setTextColor(30, 30, 30);
      doc.text("Criteria Performance", 14, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [["Criterion", "Category", "Avg Self", "Avg Manager"]],
        body: data.criteriaStats.map(c => [c.name, c.category, c.avgSelfScore?.toFixed(2) ?? "N/A", c.avgManagerScore?.toFixed(2) ?? "N/A"]),
        theme: "striped",
      });
    }
    const fileName = selectedDept ? `PerformIQ_${selectedDept.replace(/\s+/g, "_")}_Report.pdf` : "PerformIQ_Report.pdf";
    doc.save(fileName);
  };

  const statusChartData = data
    ? Object.entries(data.appraisals.statusBreakdown).map(([status, count]) => ({ name: status.replace(/_/g, " "), value: count, status }))
    : [];
  const ratingData = data?.ratingDistribution.filter(r => r.count > 0) ?? [];

  return (
    <div>
      {/* Dept filter + export */}
      <div className="flex flex-wrap gap-2 items-center mb-6">
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <select
            className="pl-9 pr-8 py-2 rounded-xl border border-border bg-card text-sm font-medium appearance-none cursor-pointer hover:bg-muted transition-colors"
            value={selectedDept}
            onChange={e => handleDeptChange(e.target.value)}
          >
            <option value="">All Departments</option>
            {data?.departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={handleExportExcel} disabled={!data}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
            <FileSpreadsheet className="w-4 h-4 text-green-600" /> Excel
          </button>
          <button onClick={handleExportPDF} disabled={!data}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
            <Download className="w-4 h-4 text-red-500" /> PDF
          </button>
        </div>
      </div>

      {selectedDept && (
        <div className="mb-4 flex items-center gap-2">
          <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> {selectedDept}
          </span>
          <button onClick={() => handleDeptChange("")} className="text-xs text-muted-foreground underline hover:text-foreground">Clear filter</button>
        </div>
      )}

      {loading && <div className="flex items-center justify-center h-64 text-muted-foreground">Loading report data…</div>}
      {error && <div className="flex items-center justify-center h-64 text-destructive">{error}</div>}
      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: selectedDept ? `Employees in ${selectedDept}` : "Total Employees", value: data.workforce.total, icon: Users, color: "text-blue-500 bg-blue-50" },
              { label: "Total Appraisals", value: data.appraisals.total, icon: BarChart3, color: "text-purple-500 bg-purple-50" },
              { label: "Completion Rate", value: `${data.appraisals.completionRate}%`, icon: CheckCircle2, color: "text-green-500 bg-green-50" },
              { label: "Avg Overall Score", value: data.appraisals.avgOverallScore?.toFixed(2) ?? "N/A", icon: TrendingUp, color: "text-amber-500 bg-amber-50" },
            ].map(card => (
              <Card key={card.label} className="p-5 flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${card.color}`}>
                  <card.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{card.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
                </div>
              </Card>
            ))}
          </div>

          {selectedDept && data.employeeList.length > 0 && (
            <Card className="p-6 mb-6">
              <h3 className="font-semibold text-foreground mb-4">{selectedDept} — Staff Performance</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Name</th>
                      <th className="pb-2 pr-4 font-medium hidden sm:table-cell">Job Title</th>
                      <th className="pb-2 pr-4 font-medium hidden md:table-cell">Role</th>
                      <th className="pb-2 pr-4 font-medium text-right">Appraisals</th>
                      <th className="pb-2 pr-4 font-medium text-right">Completed</th>
                      <th className="pb-2 pr-4 font-medium text-right">Completion</th>
                      <th className="pb-2 font-medium text-right">Avg Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.employeeList.map(e => (
                      <tr key={e.id} className="hover:bg-muted/30">
                        <td className="py-2.5 pr-4 font-medium">{e.name}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground hidden sm:table-cell">{e.jobTitle ?? "—"}</td>
                        <td className="py-2.5 pr-4 hidden md:table-cell capitalize">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${e.role === "manager" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"}`}>{e.role}</span>
                        </td>
                        <td className="py-2.5 pr-4 text-right">{e.totalAppraisals}</td>
                        <td className="py-2.5 pr-4 text-right">{e.completed}</td>
                        <td className="py-2.5 pr-4 text-right">
                          <span className={`font-semibold ${e.completionRate === 100 ? "text-green-600" : e.completionRate >= 50 ? "text-amber-600" : "text-red-500"}`}>{e.completionRate}%</span>
                        </td>
                        <td className="py-2.5 text-right font-medium">
                          {e.avgScore !== null
                            ? <span className={e.avgScore >= 4 ? "text-green-600" : e.avgScore >= 2.5 ? "text-amber-600" : "text-red-500"}>{e.avgScore.toFixed(2)}</span>
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-4">Appraisals by Status</h3>
              {statusChartData.length === 0
                ? <p className="text-muted-foreground text-sm">No appraisal data yet.</p>
                : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={statusChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                        {statusChartData.map((entry, i) => <Cell key={i} fill={STATUS_COLORS[entry.status] || PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-4">Rating Distribution</h3>
              {ratingData.length === 0
                ? <p className="text-muted-foreground text-sm">No scored appraisals yet.</p>
                : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={ratingData} layout="vertical" margin={{ left: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="label" width={175} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
            </Card>
          </div>

          {!selectedDept && data.avgScoreByDept.length > 0 && (
            <Card className="p-6 mb-6">
              <h3 className="font-semibold text-foreground mb-4">Average Score by Department</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.avgScoreByDept}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="department" />
                  <YAxis domain={[0, 5]} />
                  <Tooltip formatter={(v: any) => [Number(v).toFixed(2), "Avg Score"]} />
                  <Bar dataKey="avgScore" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <Card className="p-6 mb-6">
            <h3 className="font-semibold text-foreground mb-4">
              Appraisal Cycle Summary
              {selectedDept && <span className="ml-2 text-sm font-normal text-muted-foreground">— {selectedDept} only</span>}
            </h3>
            {data.cycleStats.length === 0
              ? <p className="text-muted-foreground text-sm">No appraisals in any cycle for this department yet.</p>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Cycle</th>
                        <th className="pb-2 pr-4 font-medium">Status</th>
                        <th className="pb-2 pr-4 font-medium text-right">Total</th>
                        <th className="pb-2 pr-4 font-medium text-right">Completed</th>
                        <th className="pb-2 pr-4 font-medium text-right">Completion</th>
                        <th className="pb-2 font-medium text-right">Avg Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.cycleStats.map(c => (
                        <tr key={c.id} className="hover:bg-muted/30">
                          <td className="py-2 pr-4 font-medium">{c.name}</td>
                          <td className="py-2 pr-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${c.status === "active" ? "bg-green-100 text-green-700" : c.status === "closed" ? "bg-slate-100 text-slate-600" : "bg-yellow-100 text-yellow-700"}`}>{c.status}</span>
                          </td>
                          <td className="py-2 pr-4 text-right">{c.total}</td>
                          <td className="py-2 pr-4 text-right">{c.completed}</td>
                          <td className="py-2 pr-4 text-right">
                            <span className={`font-semibold ${c.completionRate === 100 ? "text-green-600" : c.completionRate >= 50 ? "text-amber-600" : "text-red-500"}`}>{c.completionRate}%</span>
                          </td>
                          <td className="py-2 text-right">{c.avgScore?.toFixed(2) ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </Card>

          {data.criteriaStats.some(c => c.avgSelfScore !== null || c.avgManagerScore !== null) && (
            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-4">
                Criteria Performance
                {selectedDept && <span className="ml-2 text-sm font-normal text-muted-foreground">— {selectedDept} only</span>}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Criterion</th>
                      <th className="pb-2 pr-4 font-medium">Category</th>
                      <th className="pb-2 pr-4 font-medium text-right">Avg Self Score</th>
                      <th className="pb-2 font-medium text-right">Avg Manager Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.criteriaStats.map(c => (
                      <tr key={c.id} className="hover:bg-muted/30">
                        <td className="py-2 pr-4 font-medium">{c.name}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{c.category}</td>
                        <td className="py-2 pr-4 text-right">{c.avgSelfScore?.toFixed(2) ?? "—"}</td>
                        <td className="py-2 text-right">{c.avgManagerScore?.toFixed(2) ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "appraisals" | "attendance" | "timesheets";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "appraisals", label: "Appraisals", icon: BarChart3 },
  { id: "attendance", label: "Attendance", icon: Clock },
  { id: "timesheets", label: "Timesheets", icon: ClipboardCheck },
];

export default function Reports() {
  const [activeTab, setActiveTab] = useState<Tab>("appraisals");

  return (
    <div>
      <PageHeader title="Reports & Analytics" description="Performance, attendance, and timesheet insights across the organisation." />

      {/* Tab Bar */}
      <div className="flex gap-1 bg-muted/40 rounded-xl p-1 mb-6 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "appraisals" && <AppraisalsTab />}
      {activeTab === "attendance" && <AttendanceTab />}
      {activeTab === "timesheets" && <TimesheetsTab />}
    </div>
  );
}
