import { useState, useEffect } from "react";
import { PageHeader, Card } from "@/components/shared";
import { BarChart3, Download, Users, CheckCircle2, TrendingUp, FileSpreadsheet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const STATUS_COLORS: Record<string, string> = {
  completed: "#22c55e",
  manager_review: "#3b82f6",
  self_review: "#f59e0b",
  pending: "#94a3b8",
  pending_approval: "#8b5cf6",
};
const PIE_COLORS = ["#22c55e", "#f59e0b", "#3b82f6", "#ef4444", "#94a3b8"];

type ReportData = {
  workforce: { total: number; roleBreakdown: Record<string, number>; deptBreakdown: Record<string, number> };
  appraisals: { total: number; completed: number; completionRate: number; avgOverallScore: number | null; statusBreakdown: Record<string, number> };
  avgScoreByDept: { department: string; avgScore: number; count: number }[];
  cycleStats: { id: number; name: string; status: string; total: number; completed: number; completionRate: number; avgScore: number | null }[];
  criteriaStats: { id: number; name: string; category: string; avgSelfScore: number | null; avgManagerScore: number | null }[];
  ratingDistribution: { label: string; count: number }[];
};

export default function Reports() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };

  useEffect(() => {
    fetch("/api/reports", { headers })
      .then(r => r.ok ? r.json() : Promise.reject("Failed to load"))
      .then(setData)
      .catch(() => setError("Could not load report data."))
      .finally(() => setLoading(false));
  }, []);

  const handleExportExcel = async () => {
    if (!data) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    // Workforce sheet
    const wfRows = [["Role", "Count"], ...Object.entries(data.workforce.roleBreakdown)];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wfRows), "Workforce");

    // Appraisals sheet
    const apRows = [["Metric", "Value"],
      ["Total", data.appraisals.total],
      ["Completed", data.appraisals.completed],
      ["Completion Rate (%)", data.appraisals.completionRate],
      ["Average Score", data.appraisals.avgOverallScore ?? "N/A"],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(apRows), "Appraisal Summary");

    // Cycle stats sheet
    const cycRows = [["Cycle", "Status", "Total", "Completed", "Completion %", "Avg Score"],
      ...data.cycleStats.map(c => [c.name, c.status, c.total, c.completed, c.completionRate, c.avgScore ?? "N/A"])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cycRows), "Cycle Stats");

    // Dept scores sheet
    const deptRows = [["Department", "Avg Score", "Count"],
      ...data.avgScoreByDept.map(d => [d.department, d.avgScore, d.count])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(deptRows), "Dept Scores");

    // Criteria sheet
    const critRows = [["Criterion", "Category", "Avg Self", "Avg Manager"],
      ...data.criteriaStats.map(c => [c.name, c.category, c.avgSelfScore ?? "N/A", c.avgManagerScore ?? "N/A"])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(critRows), "Criteria");

    XLSX.writeFile(wb, "PerformIQ_Report.xlsx");
  };

  const handleExportPDF = async () => {
    if (!data) return;
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF();
    let y = 20;
    const addSection = (title: string) => {
      doc.setFontSize(13);
      doc.setTextColor(30, 30, 30);
      doc.text(title, 14, y);
      y += 6;
    };

    doc.setFontSize(18);
    doc.setTextColor(59, 130, 246);
    doc.text("PerformIQ — Performance Report", 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, y);
    y += 10;

    addSection("Appraisal Summary");
    autoTable(doc, {
      startY: y,
      head: [["Metric", "Value"]],
      body: [
        ["Total Appraisals", data.appraisals.total],
        ["Completed", data.appraisals.completed],
        ["Completion Rate", `${data.appraisals.completionRate}%`],
        ["Average Score", data.appraisals.avgOverallScore?.toFixed(2) ?? "N/A"],
        ["Total Employees", data.workforce.total],
      ],
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    addSection("Cycle Statistics");
    autoTable(doc, {
      startY: y,
      head: [["Cycle", "Status", "Total", "Completed", "Completion %", "Avg Score"]],
      body: data.cycleStats.map(c => [c.name, c.status, c.total, c.completed, `${c.completionRate}%`, c.avgScore?.toFixed(2) ?? "N/A"]),
      theme: "striped",
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    if (y > 240) { doc.addPage(); y = 20; }
    addSection("Average Score by Department");
    autoTable(doc, {
      startY: y,
      head: [["Department", "Avg Score", "Appraisals"]],
      body: data.avgScoreByDept.map(d => [d.department, d.avgScore.toFixed(2), d.count]),
      theme: "striped",
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    if (y > 240) { doc.addPage(); y = 20; }
    addSection("Criteria Performance");
    autoTable(doc, {
      startY: y,
      head: [["Criterion", "Category", "Avg Self Score", "Avg Manager Score"]],
      body: data.criteriaStats.map(c => [c.name, c.category, c.avgSelfScore?.toFixed(2) ?? "N/A", c.avgManagerScore?.toFixed(2) ?? "N/A"]),
      theme: "striped",
    });

    doc.save("PerformIQ_Report.pdf");
  };

  const statusChartData = data
    ? Object.entries(data.appraisals.statusBreakdown).map(([status, count]) => ({ name: status.replace(/_/g, " "), value: count, status }))
    : [];

  const ratingData = data?.ratingDistribution.filter(r => r.count > 0) ?? [];

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading report data…</div>;
  if (error) return <div className="flex items-center justify-center h-64 text-destructive">{error}</div>;
  if (!data) return null;

  return (
    <div>
      <PageHeader title="Reports & Analytics" description="Organisation-wide performance insights.">
        <div className="flex gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-green-600" /> Export Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
          >
            <Download className="w-4 h-4 text-red-500" /> Export PDF
          </button>
        </div>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Employees", value: data.workforce.total, icon: Users, color: "text-blue-500 bg-blue-50" },
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Status breakdown */}
        <Card className="p-6">
          <h3 className="font-semibold text-foreground mb-4">Appraisals by Status</h3>
          {statusChartData.length === 0 ? (
            <p className="text-muted-foreground text-sm">No appraisal data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {statusChartData.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.status] || PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Rating distribution */}
        <Card className="p-6">
          <h3 className="font-semibold text-foreground mb-4">Rating Distribution</h3>
          {ratingData.length === 0 ? (
            <p className="text-muted-foreground text-sm">No scored appraisals yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ratingData} layout="vertical" margin={{ left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={180} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Avg score by dept */}
      {data.avgScoreByDept.length > 0 && (
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

      {/* Cycle stats table */}
      <Card className="p-6 mb-6">
        <h3 className="font-semibold text-foreground mb-4">Appraisal Cycle Summary</h3>
        {data.cycleStats.length === 0 ? (
          <p className="text-muted-foreground text-sm">No cycles found.</p>
        ) : (
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
                    <td className="py-2 pr-4 capitalize">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status === "active" ? "bg-green-100 text-green-700" : c.status === "closed" ? "bg-slate-100 text-slate-600" : "bg-yellow-100 text-yellow-700"}`}>{c.status}</span>
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

      {/* Criteria performance */}
      {data.criteriaStats.some(c => c.avgSelfScore !== null || c.avgManagerScore !== null) && (
        <Card className="p-6">
          <h3 className="font-semibold text-foreground mb-4">Criteria Performance</h3>
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
    </div>
  );
}
