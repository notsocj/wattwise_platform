import {
  Activity,
  CreditCard,
  MonitorSmartphone,
  TrendingUp,
  UserPlus,
  Users,
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
  DeviceAdoptionChart,
  UserGrowthChart,
} from "@/components/admin/AdminGrowthCharts";

const growthMetrics = [
  {
    label: "Total Users",
    value: "128",
    helper: "Registered WattWise accounts",
    trend: "+18%",
    icon: Users,
    tone: "info" as const,
  },
  {
    label: "New Users 7d",
    value: "14",
    helper: "Recent signups",
    trend: "+6 vs last week",
    icon: UserPlus,
    tone: "success" as const,
  },
  {
    label: "New Users 30d",
    value: "42",
    helper: "Monthly adoption signal",
    trend: "+12%",
    icon: TrendingUp,
    tone: "success" as const,
  },
  {
    label: "Total Devices",
    value: "342",
    helper: "Paired ESP32-S3 devices",
    trend: "+28 this month",
    icon: MonitorSmartphone,
    tone: "default" as const,
  },
  {
    label: "Active Devices",
    value: "286",
    helper: "Mock online or recently active",
    trend: "84% online",
    icon: Activity,
    tone: "success" as const,
  },
  {
    label: "Hypothetical MRR",
    value: "PHP 19.2K",
    helper: "Preview at PHP 150/user",
    trend: "Mock",
    icon: CreditCard,
    tone: "warning" as const,
  },
];

const userGrowthData = [
  { day: "Apr 23", users: 86, devices: 228 },
  { day: "Apr 27", users: 91, devices: 241 },
  { day: "May 01", users: 95, devices: 253 },
  { day: "May 05", users: 101, devices: 268 },
  { day: "May 09", users: 108, devices: 284 },
  { day: "May 13", users: 115, devices: 302 },
  { day: "May 17", users: 121, devices: 325 },
  { day: "May 21", users: 128, devices: 342 },
];

const deviceAdoptionData = [
  { type: "Aircon", devices: 94 },
  { type: "Fridge", devices: 82 },
  { type: "TV", devices: 61 },
  { type: "Other", devices: 105 },
];

const cohortColumns = [
  { key: "segment", header: "Segment" },
  { key: "users", header: "Users", align: "right" as const },
  { key: "devices", header: "Devices", align: "right" as const },
  { key: "avgDevices", header: "Avg Devices", align: "right" as const },
  { key: "status", header: "Status" },
];

const cohortRows = [
  {
    segment: "New users this week",
    users: "14",
    devices: "22",
    avgDevices: "1.6",
    status: <AdminStatusBadge tone="success">Growing</AdminStatusBadge>,
  },
  {
    segment: "Active households",
    users: "96",
    devices: "286",
    avgDevices: "3.0",
    status: <AdminStatusBadge tone="info">Healthy</AdminStatusBadge>,
  },
  {
    segment: "Dormant users",
    users: "18",
    devices: "34",
    avgDevices: "1.9",
    status: <AdminStatusBadge tone="warning">Watch</AdminStatusBadge>,
  },
];

export default function AdminGrowthPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={TrendingUp}
        title="Revenue & Growth"
        description="Frontend preview for adoption trends, active devices, and simple owner-level revenue signals."
        actions={<AdminStatusBadge tone="warning">Mock Data</AdminStatusBadge>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {growthMetrics.map((metric) => (
          <AdminMetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <AdminChartCard
          title="30-Day User & Device Growth"
          description="Mock trend comparing registered users and paired devices over the last month."
          height={320}
          actions={<AdminStatusBadge tone="info">30 days</AdminStatusBadge>}
        >
          <UserGrowthChart data={userGrowthData} />
        </AdminChartCard>

        <AdminChartCard
          title="Device Adoption"
          description="Mock breakdown by appliance category."
          height={320}
          actions={<AdminStatusBadge tone="neutral">Preview</AdminStatusBadge>}
        >
          <DeviceAdoptionChart data={deviceAdoptionData} />
        </AdminChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
        <AdminSection
          title="MRR Preview"
          description="Static model for future subscription or service revenue planning."
        >
          <div className="rounded-lg border border-mint/25 bg-mint/10 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-mint/70">
              Formula
            </p>
            <p className="mt-3 text-3xl font-bold text-mint">128 x PHP 150</p>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Hypothetical pricing model only. No billing backend is connected
              in this UI phase.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                ARPU
              </p>
              <p className="mt-2 text-xl font-bold text-white">PHP 150</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                Projected MRR
              </p>
              <p className="mt-2 text-xl font-bold text-white">PHP 19,200</p>
            </div>
          </div>
        </AdminSection>

        <AdminSection
          title="Adoption Segments"
          description="Mock cohort table for future user and device growth analysis."
        >
          <AdminTable columns={cohortColumns} rows={cohortRows} />
        </AdminSection>
      </div>
    </div>
  );
}
