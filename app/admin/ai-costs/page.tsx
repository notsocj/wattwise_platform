import {
  BadgeDollarSign,
  Brain,
  Clock,
  DatabaseZap,
  MessageSquareText,
  Sparkles,
  WalletCards,
} from "lucide-react";
import {
  AdminChartCard,
  AdminMetricCard,
  AdminPageHeader,
  AdminSection,
  AdminStatusBadge,
  AdminTable,
} from "@/components/admin";
import {
  InsightBreakdownChart,
  TokenUsageChart,
} from "@/components/admin/AdminAiCostCharts";

const costMetrics = [
  {
    label: "Insights Generated",
    value: "1,924",
    helper: "Mock all-time AI responses",
    trend: "+86 this week",
    icon: MessageSquareText,
    tone: "success" as const,
  },
  {
    label: "Prompt Tokens",
    value: "428K",
    helper: "Estimated input tokens",
    trend: "62%",
    icon: DatabaseZap,
    tone: "default" as const,
  },
  {
    label: "Completion Tokens",
    value: "261K",
    helper: "Estimated output tokens",
    trend: "38%",
    icon: Sparkles,
    tone: "info" as const,
  },
  {
    label: "Total Tokens",
    value: "689K",
    helper: "Prompt plus completion usage",
    trend: "+12.4%",
    icon: Brain,
    tone: "warning" as const,
  },
  {
    label: "Estimated Cost",
    value: "$2.18",
    helper: "Mock USD spend preview",
    trend: "$0.31 this week",
    icon: BadgeDollarSign,
    tone: "success" as const,
  },
  {
    label: "Cache Savings",
    value: "312",
    helper: "Mock cached insight returns",
    trend: "16.2%",
    icon: WalletCards,
    tone: "info" as const,
  },
];

const tokenUsageData = [
  { day: "Mon", prompt: 42000, completion: 26000 },
  { day: "Tue", prompt: 51000, completion: 33000 },
  { day: "Wed", prompt: 47000, completion: 28000 },
  { day: "Thu", prompt: 68000, completion: 41000 },
  { day: "Fri", prompt: 59000, completion: 36000 },
  { day: "Sat", prompt: 44000, completion: 24000 },
  { day: "Sun", prompt: 39000, completion: 21000 },
];

const insightBreakdownData = [
  { type: "Budget", count: 612, color: "#00E66F" },
  { type: "Weekly", count: 486, color: "rgba(255,255,255,0.62)" },
  { type: "Anomaly", count: 328, color: "#F59E0B" },
  { type: "Optimizer", count: 498, color: "#10B981" },
];

const costRows = [
  {
    type: "budget_alert",
    generated: "612",
    tokens: "218K",
    cost: "$0.69",
    cache: "18%",
    status: <AdminStatusBadge tone="success">Efficient</AdminStatusBadge>,
  },
  {
    type: "weekly_recap",
    generated: "486",
    tokens: "191K",
    cost: "$0.61",
    cache: "22%",
    status: <AdminStatusBadge tone="info">Stable</AdminStatusBadge>,
  },
  {
    type: "anomaly_alert",
    generated: "328",
    tokens: "104K",
    cost: "$0.34",
    cache: "9%",
    status: <AdminStatusBadge tone="warning">Watch</AdminStatusBadge>,
  },
  {
    type: "cost_optimizer",
    generated: "498",
    tokens: "176K",
    cost: "$0.54",
    cache: "15%",
    status: <AdminStatusBadge tone="success">Efficient</AdminStatusBadge>,
  },
];

const costColumns = [
  { key: "type", header: "Insight Type" },
  { key: "generated", header: "Generated", align: "right" as const },
  { key: "tokens", header: "Tokens", align: "right" as const },
  { key: "cost", header: "Est. Cost", align: "right" as const },
  { key: "cache", header: "Cache Hit", align: "right" as const },
  { key: "status", header: "Status" },
];

const recentLogRows = [
  {
    time: "Today, 10:42 AM",
    user: "household_128",
    type: "budget_alert",
    tokens: "1,284",
    status: <AdminStatusBadge tone="success">Cached</AdminStatusBadge>,
  },
  {
    time: "Today, 10:18 AM",
    user: "household_094",
    type: "cost_optimizer",
    tokens: "2,106",
    status: <AdminStatusBadge tone="info">Generated</AdminStatusBadge>,
  },
  {
    time: "Today, 9:51 AM",
    user: "household_077",
    type: "weekly_recap",
    tokens: "1,742",
    status: <AdminStatusBadge tone="info">Generated</AdminStatusBadge>,
  },
  {
    time: "Yesterday, 8:36 PM",
    user: "household_041",
    type: "anomaly_alert",
    tokens: "964",
    status: <AdminStatusBadge tone="warning">Review</AdminStatusBadge>,
  },
];

const recentLogColumns = [
  { key: "time", header: "Time" },
  { key: "user", header: "User" },
  { key: "type", header: "Type" },
  { key: "tokens", header: "Tokens", align: "right" as const },
  { key: "status", header: "Status" },
];

export default function AdminAiCostsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={Brain}
        title="OpenAI Cost Tracker"
        description="Frontend preview for token usage, estimated USD cost, cache savings, and AI insight generation volume."
        actions={<AdminStatusBadge tone="warning">Mock Data</AdminStatusBadge>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {costMetrics.map((metric) => (
          <AdminMetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <AdminChartCard
          title="Daily Token Usage"
          description="Mock stacked token usage for prompt and completion tokens."
          height={320}
          actions={<AdminStatusBadge tone="info">7 days</AdminStatusBadge>}
        >
          <TokenUsageChart data={tokenUsageData} />
        </AdminChartCard>

        <AdminChartCard
          title="Insight Type Volume"
          description="Mock generated insight count by AI feature."
          height={320}
          actions={<AdminStatusBadge tone="neutral">Preview</AdminStatusBadge>}
        >
          <InsightBreakdownChart data={insightBreakdownData} />
        </AdminChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <AdminSection
          title="Pricing Preview"
          description="Static cost model placeholder for future OpenAI pricing configuration."
        >
          <div className="space-y-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-2 flex items-center gap-2 text-mint">
                <Clock className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-wider">
                  Current Window
                </p>
              </div>
              <p className="text-2xl font-bold text-white">May 2026</p>
              <p className="mt-2 text-sm leading-6 text-white/50">
                Usage window shown for UI preview only.
              </p>
            </div>

            <div className="rounded-lg border border-mint/25 bg-mint/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-mint/70">
                Cost Formula
              </p>
              <p className="mt-2 text-sm leading-6 text-white/60">
                Prompt tokens x input rate plus completion tokens x output rate.
                This page will use saved token counts once backend wiring starts.
              </p>
            </div>
          </div>
        </AdminSection>

        <AdminSection
          title="Cost Breakdown"
          description="Mock aggregate table grouped by AI insight type."
        >
          <AdminTable columns={costColumns} rows={costRows} />
        </AdminSection>
      </div>

      <AdminSection
        title="Recent AI Insight Logs"
        description="Mock log feed for future generated and cached AI insight events."
      >
        <AdminTable columns={recentLogColumns} rows={recentLogRows} />
      </AdminSection>
    </div>
  );
}
