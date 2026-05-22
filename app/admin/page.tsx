import Link from "next/link";
import {
  Activity,
  BarChart3,
  Brain,
  Database,
  DollarSign,
  Gauge,
  HeartPulse,
  Server,
  Shield,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import {
  AdminMetricCard,
  AdminPageHeader,
  AdminSection,
  AdminStatusBadge,
  AdminTable,
} from "@/components/admin";

const overviewMetrics = [
  {
    label: "Total Users",
    value: "128",
    helper: "Registered WattWise accounts",
    trend: "+12 this month",
    icon: Users,
    tone: "info" as const,
  },
  {
    label: "Paired Devices",
    value: "342",
    helper: "ESP32-S3 units linked to homes",
    trend: "+28 this month",
    icon: Zap,
    tone: "success" as const,
  },
  {
    label: "Active Devices",
    value: "286",
    helper: "Reporting recent telemetry",
    trend: "84% online",
    icon: Activity,
    tone: "success" as const,
  },
  {
    label: "Energy Monitored",
    value: "4.8 MWh",
    helper: "All-time platform usage",
    trend: "+9.4% weekly",
    icon: BarChart3,
    tone: "default" as const,
  },
  {
    label: "AI Insights",
    value: "1,924",
    helper: "Generated Tipid Advisor messages",
    trend: "312 cached",
    icon: Brain,
    tone: "warning" as const,
  },
  {
    label: "System Status",
    value: "Healthy",
    helper: "No critical incidents detected",
    trend: "Live",
    icon: HeartPulse,
    tone: "success" as const,
  },
];

const quickActions = [
  {
    href: "/admin/rates",
    title: "Update Meralco Rates",
    description: "Prepare the global billing source of truth for all users.",
    icon: DollarSign,
  },
  {
    href: "/admin/health",
    title: "Review System Health",
    description: "Check storage usage, fleet status, and telemetry freshness.",
    icon: Server,
  },
  {
    href: "/admin/ai-costs",
    title: "Monitor AI Costs",
    description: "Inspect token usage and estimated OpenAI spend.",
    icon: Brain,
  },
];

const recentActivityRows = [
  {
    event: "Meralco rate sync completed",
    area: "Rates",
    status: <AdminStatusBadge tone="success">Success</AdminStatusBadge>,
    time: "Today, 11:08 AM",
  },
  {
    event: "12 new devices paired",
    area: "Growth",
    status: <AdminStatusBadge tone="info">Info</AdminStatusBadge>,
    time: "Today, 9:42 AM",
  },
  {
    event: "AI usage crossed daily review marker",
    area: "AI Costs",
    status: <AdminStatusBadge tone="warning">Review</AdminStatusBadge>,
    time: "Yesterday, 6:15 PM",
  },
  {
    event: "Offline device group detected",
    area: "Health",
    status: <AdminStatusBadge tone="danger">Attention</AdminStatusBadge>,
    time: "Yesterday, 3:24 PM",
  },
];

const recentActivityColumns = [
  { key: "event", header: "Event" },
  { key: "area", header: "Area" },
  { key: "status", header: "Status" },
  { key: "time", header: "Time", align: "right" as const },
];

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={Shield}
        title="Overview"
        description="Platform summary, operating signals, and shortcuts for managing WattWise Mission Control."
        actions={
          <AdminStatusBadge tone="success">Mock UI Preview</AdminStatusBadge>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {overviewMetrics.map((metric) => (
          <AdminMetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <AdminSection
          title="Mission Snapshot"
          description="Static preview of the core signals the admin dashboard will surface once backend wiring starts."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center gap-2 text-mint">
                <Gauge className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Fleet Health
                </span>
              </div>
              <p className="text-3xl font-bold text-white">84%</p>
              <p className="mt-2 text-sm leading-6 text-white/50">
                Devices currently online or recently active.
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center gap-2 text-mint">
                <Database className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Storage
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[38%] rounded-full bg-mint" />
              </div>
              <p className="mt-3 text-sm leading-6 text-white/50">
                38% estimated Supabase storage usage.
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center gap-2 text-mint">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Growth
                </span>
              </div>
              <p className="text-3xl font-bold text-white">+18%</p>
              <p className="mt-2 text-sm leading-6 text-white/50">
                Mock 30-day adoption trend for users and devices.
              </p>
            </div>
          </div>
        </AdminSection>

        <AdminSection title="Quick Actions" description="Jump into the main admin workspaces.">
          <div className="space-y-3">
            {quickActions.map(({ href, title, description, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-mint/30 hover:bg-mint/5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-mint/20 bg-mint/10 text-mint">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white transition-colors group-hover:text-mint">
                    {title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-white/50">
                    {description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </AdminSection>
      </div>

      <AdminSection
        title="Recent Admin Activity"
        description="Mock activity feed for the future audit log and operational event stream."
      >
        <AdminTable
          columns={recentActivityColumns}
          rows={recentActivityRows}
        />
      </AdminSection>
    </div>
  );
}
