import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DateRangeFilter,
  DateRange,
  dateRangeToParams,
  DEFAULT_DATE_RANGE,
  dateRangeLabel,
} from "@/components/date-range-filter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  TrendingUp,
  AlertTriangle,
  Package,
  HelpCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  MessageCircle,
  ShieldAlert,
  Tag,
  ChevronRight,
  Brain,
} from "lucide-react";
import { apiGet, getBaseUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface InsightsSummary {
  totalCustomerMessages: number;
  totalQuestions: number;
  questionsRate: number;
  totalCompliance: number;
  topIssueCategory: string;
}

interface TopQuestion {
  topic: string;
  count: number;
  sample: string;
}

interface IssueCategory {
  name: string;
  count: number;
  color: string;
  icon: string;
}

interface ProductMention {
  name: string;
  count: number;
  source: string;
}

interface ComplianceFlag {
  conversationId: number;
  messageId: number;
  keyword: string;
  severity: "high" | "medium";
  snippet: string;
  createdAt: string;
}

interface TagStat {
  tag: string;
  count: number;
}

interface CustomerInsights {
  period: string;
  summary: InsightsSummary;
  topQuestions: TopQuestion[];
  topIssues: IssueCategory[];
  topProducts: ProductMention[];
  complianceFlags: ComplianceFlag[];
  topTags: TagStat[];
}

interface AiTheme {
  theme: string;
  description: string;
  urgency: "high" | "medium" | "low";
}

interface AiSummaryData {
  keyThemes?: AiTheme[];
  productsMentioned?: string[];
  sentimentOverall?: string;
  sentimentNote?: string;
  recommendations?: string[];
  rawText?: string;
}

const SEVERITY_COLORS = {
  high: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900",
  medium:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900",
};

const URGENCY_COLORS = {
  high: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  medium:
    "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  low: "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
};

const SENTIMENT_META = {
  positive: {
    color: "text-green-600",
    bg: "bg-green-50 dark:bg-green-950/20",
    icon: "😊",
  },
  neutral: {
    color: "text-slate-600",
    bg: "bg-slate-50 dark:bg-slate-900/20",
    icon: "😐",
  },
  negative: {
    color: "text-red-600",
    bg: "bg-red-50 dark:bg-red-950/20",
    icon: "😟",
  },
  mixed: {
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950/20",
    icon: "🤔",
  },
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-0.5">{value}</p>
            {sub && (
              <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
            )}
          </div>
          <div
            className={`h-10 w-10 rounded-xl ${color} flex items-center justify-center shrink-0`}
          >
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon: Icon,
  text,
}: {
  icon: React.ElementType;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
      <Icon className="h-9 w-9 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

export default function Insights() {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_DATE_RANGE);
  const [aiSummary, setAiSummary] = useState<AiSummaryData | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery<CustomerInsights>(
    {
      queryKey: ["customer-insights", dateRange],
      queryFn: () => {
        const p = new URLSearchParams(dateRangeToParams(dateRange));
        return apiGet(`/insights/customer?${p.toString()}`);
      },
    },
  );

  const runAiSummary = async () => {
    setAiLoading(true);
    setAiSummary(null);
    try {
      const token = localStorage.getItem("crm_token");
      const baseUrl = getBaseUrl();
      const days = dateRange.mode === "preset" ? dateRange.days : 30;
      const res = await fetch(`${baseUrl}/insights/ai-summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ days }),
      });
      const result = await res.json();
      if (result.ok && result.data) {
        setAiSummary(result.data);
      } else {
        toast({ title: "AI analysis failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not reach AI service", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6 text-violet-500" />
            Customer Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">
            Track customer questions, top issues, product mentions, and
            compliance flags.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`}
            />
          </Button>
          <Button
            onClick={runAiSummary}
            disabled={aiLoading}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
          >
            {aiLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            AI Analysis
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !data ? null : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={MessageCircle}
              label="Customer Messages"
              value={data.summary.totalCustomerMessages.toLocaleString()}
              sub={data.period}
              color="bg-blue-500"
            />
            <StatCard
              icon={HelpCircle}
              label="Questions Asked"
              value={data.summary.totalQuestions.toLocaleString()}
              sub={`${data.summary.questionsRate}% of messages`}
              color="bg-violet-500"
            />
            <StatCard
              icon={TrendingUp}
              label="Top Issue Category"
              value={data.summary.topIssueCategory}
              sub="by conversation volume"
              color="bg-indigo-500"
            />
            <StatCard
              icon={ShieldAlert}
              label="Compliance Flags"
              value={data.summary.totalCompliance}
              sub="requiring review"
              color={
                data.summary.totalCompliance > 0 ? "bg-red-500" : "bg-slate-400"
              }
            />
          </div>

          {/* AI Summary (shown when available) */}
          {aiSummary && (
            <Card className="mb-6 border-violet-200 dark:border-violet-900 bg-violet-50/50 dark:bg-violet-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-violet-700 dark:text-violet-400">
                  <Sparkles className="h-4 w-4" /> AI-Powered Analysis
                  <Badge className="ml-auto text-xs font-normal">
                    Powered by AI
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {aiSummary.rawText ? (
                  <pre className="text-xs text-foreground whitespace-pre-wrap">
                    {aiSummary.rawText}
                  </pre>
                ) : (
                  <>
                    {/* Sentiment */}
                    {aiSummary.sentimentOverall && (
                      <div
                        className={`p-3 rounded-lg text-sm flex items-start gap-2.5 ${SENTIMENT_META[aiSummary.sentimentOverall as keyof typeof SENTIMENT_META]?.bg ?? ""}`}
                      >
                        <span className="text-lg leading-none">
                          {SENTIMENT_META[
                            aiSummary.sentimentOverall as keyof typeof SENTIMENT_META
                          ]?.icon ?? "💬"}
                        </span>
                        <div>
                          <p
                            className={`font-semibold capitalize ${SENTIMENT_META[aiSummary.sentimentOverall as keyof typeof SENTIMENT_META]?.color ?? ""}`}
                          >
                            Overall sentiment: {aiSummary.sentimentOverall}
                          </p>
                          {aiSummary.sentimentNote && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {aiSummary.sentimentNote}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Key themes */}
                    {aiSummary.keyThemes && aiSummary.keyThemes.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          Key Themes
                        </p>
                        <div className="space-y-2">
                          {aiSummary.keyThemes.map((t, i) => (
                            <div key={i} className="flex items-start gap-2.5">
                              <Badge
                                className={`text-[10px] h-5 shrink-0 mt-0.5 ${URGENCY_COLORS[t.urgency]}`}
                              >
                                {t.urgency}
                              </Badge>
                              <div>
                                <p className="text-sm font-medium">{t.theme}</p>
                                <p className="text-xs text-muted-foreground">
                                  {t.description}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* AI product mentions */}
                    {aiSummary.productsMentioned &&
                      aiSummary.productsMentioned.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                            Products Mentioned (AI)
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {aiSummary.productsMentioned.map((p, i) => (
                              <Badge key={i} variant="outline">
                                {p}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    {/* Recommendations */}
                    {aiSummary.recommendations &&
                      aiSummary.recommendations.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                            Recommendations
                          </p>
                          <ul className="space-y-1.5">
                            {aiSummary.recommendations.map((r, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-2 text-sm"
                              >
                                <ChevronRight className="h-4 w-4 shrink-0 mt-0.5 text-violet-500" />
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Issues chart */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-indigo-500" /> Top Issues
                  Raised
                </CardTitle>
                <CardDescription>
                  Conversations categorised by customer topic
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.topIssues.length === 0 ? (
                  <EmptyState
                    icon={TrendingUp}
                    text="No conversations yet in this period. Issues will appear as customers message you."
                  />
                ) : (
                  <div>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={data.topIssues}
                        layout="vertical"
                        margin={{ left: 0, right: 20, top: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={false}
                          stroke="var(--border)"
                        />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 11 }}
                          width={130}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                          contentStyle={{
                            fontSize: 12,
                            borderRadius: 8,
                            border: "1px solid var(--border)",
                            backgroundColor: "var(--background)",
                          }}
                          formatter={(value) => [
                            `${value} conversations`,
                            "Volume",
                          ]}
                        />
                        <Bar
                          dataKey="count"
                          radius={[0, 4, 4, 0]}
                          maxBarSize={24}
                        >
                          {data.topIssues.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {data.topIssues.map((issue) => (
                        <div
                          key={issue.name}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground"
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-sm inline-block"
                            style={{ backgroundColor: issue.color }}
                          />
                          {issue.icon} {issue.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Questions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-violet-500" /> Top
                  Customer Questions
                </CardTitle>
                <CardDescription>
                  Most frequent question topics from customers
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.topQuestions.length === 0 ? (
                  <EmptyState
                    icon={HelpCircle}
                    text="No question patterns detected yet. Questions will appear once customers start messaging."
                  />
                ) : (
                  <div className="space-y-3">
                    {data.topQuestions.map((q, i) => (
                      <div key={i} className="group">
                        <div className="flex items-start gap-3">
                          <div className="h-6 w-6 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0 text-xs font-bold text-violet-700 dark:text-violet-400">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium capitalize">
                                {q.topic}
                              </p>
                              <Badge
                                variant="secondary"
                                className="text-xs shrink-0"
                              >
                                {q.count}×
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 italic">
                              "{q.sample}"
                            </p>
                          </div>
                        </div>
                        {i < data.topQuestions.length - 1 && (
                          <Separator className="mt-3" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Product Mentions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4 text-emerald-500" /> Top Products
                  Requested / Mentioned
                </CardTitle>
                <CardDescription>
                  Terms customers mention alongside product-related context
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.topProducts.length === 0 ? (
                  <EmptyState
                    icon={Package}
                    text="No product mentions detected yet. Products will appear as customers reference specific items."
                  />
                ) : (
                  <div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {data.topProducts.map((p, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm"
                          style={{
                            fontSize: `${Math.max(11, Math.min(15, 10 + p.count))}px`,
                          }}
                        >
                          <span className="font-medium">{p.name}</span>
                          <span className="text-muted-foreground text-xs">
                            ({p.count})
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {data.topProducts.slice(0, 6).map((p, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="text-xs text-muted-foreground w-4">
                            {i + 1}
                          </div>
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{
                                width: `${Math.min(100, (p.count / (data.topProducts[0]?.count ?? 1)) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-16 truncate">
                            {p.name}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {p.count}×
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Compliance Flags */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-red-500" /> Compliance &
                  Risk Flags
                  {data.complianceFlags.length > 0 && (
                    <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 ml-auto">
                      {data.complianceFlags.length} flagged
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Conversations containing legal, regulatory, or risk-related
                  language
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.complianceFlags.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                    <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center">
                      <ShieldAlert className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">
                      No compliance flags
                    </p>
                    <p className="text-xs text-muted-foreground">
                      No risk language detected in the selected period.
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-64">
                    <div className="space-y-3 pr-2">
                      {data.complianceFlags.map((flag, i) => (
                        <div
                          key={i}
                          className={`p-3 rounded-lg border text-xs ${SEVERITY_COLORS[flag.severity]}`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              <span className="font-semibold capitalize">
                                {flag.keyword}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                className={`text-[10px] h-4 ${SEVERITY_COLORS[flag.severity]}`}
                              >
                                {flag.severity}
                              </Badge>
                              <span className="text-muted-foreground">
                                Conv #{flag.conversationId}
                              </span>
                            </div>
                          </div>
                          <p className="italic text-[11px] leading-relaxed opacity-90">
                            {flag.snippet}
                          </p>
                          <p className="mt-1.5 text-muted-foreground text-[10px]">
                            {new Date(flag.createdAt).toLocaleDateString(
                              "en-GB",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tags analysis */}
          {data.topTags.length > 0 && (
            <Card className="mt-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Tag className="h-4 w-4 text-sky-500" /> Conversation Tags
                </CardTitle>
                <CardDescription>
                  Most used tags applied to conversations during this period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {data.topTags.map((t) => {
                    const max = data.topTags[0]?.count ?? 1;
                    const intensity = Math.max(0.3, t.count / max);
                    return (
                      <div
                        key={t.tag}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-muted/40 text-sm"
                        style={{ opacity: 0.5 + intensity * 0.5 }}
                      >
                        <Tag className="h-3 w-3 text-sky-500" />
                        <span>{t.tag}</span>
                        <Badge variant="secondary" className="text-[10px] h-4">
                          {t.count}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
