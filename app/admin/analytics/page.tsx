import {
  BarChart3,
  Coins,
  Gauge,
  Globe,
  Home,
  Leaf,
  MonitorSmartphone,
  TrendingDown,
  Users,
  Zap,
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
  ApplianceMixChart,
  PlatformEnergyChart,
} from "@/components/admin/AdminGlobalAnalyticsCharts";

const analyticsMetrics = [
  {
    label: "Total kWh Monitored",
    value: "4.8 MWh",
    helper: "Mock all-time platform usage",
    trend: "+9.4% weekly",
    icon: Zap,
    tone: "success" as const,
  },
  {
    label: "Estimated Savings",
    value: "PHP 38.6K",
    helper: "Mock week-over-week avoided cost",
    trend: "+PHP 4.2K",
    icon: Leaf,
    tone: "success" as const,
  },
  {
    label: "Platform Cost Tracked",
    value: "PHP 66.4K",
    helper: "Mock Meralco-based estimate",
    trend: "March rates",
    icon: Coins,
    tone: "warning" as const,
  },
  {
    label: "Total Users",
    value: "128",
    helper: "Registered households",
    trend: "+42 in 30d",
    icon: Users,
    tone: "info" as const,
  },
  {
    label: "Total Devices",
    value: "342",
    helper: "Paired monitored appliances",
    trend: "2.7 per user",
    icon: MonitorSmartphone,
    tone: "default" as const,
  },
  {
    label: "Peak Daily Load",
    value: "226 kWh",
    helper: "Highest mock daily aggregate",
    trend: "May 18",
    icon: Gauge,
    tone: "warning" as const,
  },
];

const platformEnergyData = [
  { day: "May 01", kwh: 142, cost: 1758 },
  { day: "May 04", kwh: 151, cost: 1869 },
  { day: "May 07", kwh: 168, cost: 2079 },
  { day: "May 10", kwh: 156, cost: 1930 },
  { day: "May 13", kwh: 184, cost: 2277 },
  { day: "May 16", kwh: 201, cost: 2487 },
  { day: "May 19", kwh: 226, cost: 2797 },
  { day: "May 22", kwh: 214, cost: 2648 },
];

const applianceMixData = [
  { type: "Aircon", kwh: 1860, color: "#00E66F" },
  { type: "Fridge", kwh: 1180, color: "#10B981" },
  { type: "TV", kwh: 640, color: "rgba(255,255,255,0.62)" },
  { type: "Other", kwh: 1120, color: "#F59E0B" },
];

const impactRows = [
  {
    rank: "1",
    segment: "Aircon-heavy households",
    devices: "94",
    kwh: "1,860",
    cost: "PHP 23.0K",
    signal: <AdminStatusBadge tone="warning">High Impact</AdminStatusBadge>,
  },
  {
    rank: "2",
    segment: "Refrigerator baseline",
    devices: "82",
    kwh: "1,180",
    cost: "PHP 14.6K",
    signal: <AdminStatusBadge tone="info">Stable</AdminStatusBadge>,
  },
  {
    rank: "3",
    segment: "Mixed appliance users",
    devices: "105",
    kwh: "1,120",
    cost: "PHP 13.9K",
    signal: <AdminStatusBadge tone="success">Optimizing</AdminStatusBadge>,
  },
  {
    rank: "4",
    segment: "TV and media devices",
    devices: "61",
    kwh: "640",
    cost: "PHP 7.9K",
    signal: <AdminStatusBadge tone="neutral">Low Load</AdminStatusBadge>,
  },
];

const impactColumns = [
  { key: "rank", header: "#" },
  { key: "segment", header: "Segment" },
  { key: "devices", header: "Devices", align: "right" as const },
  { key: "kwh", header: "kWh", align: "right" as const },
  { key: "cost", header: "Tracked Cost", align: "right" as const },
  { key: "signal", header: "Signal" },
];

const dailyRows = [
  {
    day: "May 22",
    kwh: "214",
    cost: "PHP 2,648",
    users: "96",
    change: <AdminStatusBadge tone="success">-5.3%</AdminStatusBadge>,
  },
  {
    day: "May 21",
    kwh: "219",
    cost: "PHP 2,710",
    users: "94",
    change: <AdminStatusBadge tone="neutral">+1.1%</AdminStatusBadge>,
  },
  {
    day: "May 20",
    kwh: "217",
    cost: "PHP 2,685",
    users: "93",
    change: <AdminStatusBadge tone="warning">+7.8%</AdminStatusBadge>,
  },
  {
    day: "May 19",
    kwh: "226",
    cost: "PHP 2,797",
    users: "91",
    change: <AdminStatusBadge tone="danger">Peak</AdminStatusBadge>,
  },
];

const dailyColumns = [
  { key: "day", header: "Day" },
  { key: "kwh", header: "kWh", align: "right" as const },
  { key: "cost", header: "Tracked Cost", align: "right" as const },
  { key: "users", header: "Active Users", align: "right" as const },
  { key: "change", header: "Change" },
];

export default function AdminAnalyticsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={Globe}
        title="Global Energy Analytics"
        description="Frontend preview for platform-wide energy impact, monitored cost, savings, and appliance-level usage trends."
        actions={<AdminStatusBadge tone="warning">Mock Data</AdminStatusBadge>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {analyticsMetrics.map((metric) => (
          <AdminMetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <AdminChartCard
          title="Platform Daily Energy"
          description="Mock daily kWh monitored across all WattWise users."
          height={320}
          actions={<AdminStatusBadge tone="info">May 2026</AdminStatusBadge>}
        >
          <PlatformEnergyChart data={platformEnergyData} />
        </AdminChartCard>

        <AdminChartCard
          title="Appliance Energy Mix"
          description="Mock kWh distribution by paired appliance type."
          height={320}
          actions={<AdminStatusBadge tone="neutral">Preview</AdminStatusBadge>}
        >
          <ApplianceMixChart data={applianceMixData} />
        </AdminChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <AdminSection
          title="Impact Summary"
          description="Static proof-of-impact cards for thesis and operations storytelling."
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-mint/25 bg-mint/10 p-5">
              <div className="mb-3 flex items-center gap-2 text-mint">
                <TrendingDown className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-wider">
                  Avoided Spend
                </p>
              </div>
              <p className="text-3xl font-bold text-mint">PHP 38,600</p>
              <p className="mt-2 text-sm leading-6 text-white/60">
                Mock estimated savings from week-over-week usage improvement.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-2 flex items-center gap-2 text-white/60">
                  <Home className="h-4 w-4" />
                  <p className="text-xs font-semibold uppercase tracking-wider">
                    Homes
                  </p>
                </div>
                <p className="text-xl font-bold text-white">128</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-2 flex items-center gap-2 text-white/60">
                  <BarChart3 className="h-4 w-4" />
                  <p className="text-xs font-semibold uppercase tracking-wider">
                    Avg/day
                  </p>
                </div>
                <p className="text-xl font-bold text-white">188 kWh</p>
              </div>
            </div>
          </div>
        </AdminSection>

        <AdminSection
          title="Highest Impact Segments"
          description="Mock grouped analysis for appliance categories and usage behavior."
        >
          <AdminTable columns={impactColumns} rows={impactRows} />
        </AdminSection>
      </div>

      <AdminSection
        title="Daily Platform Readings"
        description="Mock recent daily aggregate rows for future Supabase RPC output."
      >
        <AdminTable columns={dailyColumns} rows={dailyRows} />
      </AdminSection>
    </div>
  );
}
