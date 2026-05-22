import {
  AlertTriangle,
  Clock3,
  Database,
  HardDrive,
  HeartPulse,
  Router,
  Server,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  AdminMetricCard,
  AdminPageHeader,
  AdminSection,
  AdminStatusBadge,
  AdminTable,
} from "@/components/admin";

const healthMetrics = [
  {
    label: "Storage Usage",
    value: "38%",
    helper: "Mock Supabase storage estimate",
    trend: "190 MB / 500 MB",
    icon: Database,
    tone: "success" as const,
  },
  {
    label: "Energy Log Rows",
    value: "184K",
    helper: "Estimated telemetry records",
    trend: "+5.8K today",
    icon: HardDrive,
    tone: "info" as const,
  },
  {
    label: "Online Devices",
    value: "286",
    helper: "Mock active fleet count",
    trend: "84%",
    icon: Wifi,
    tone: "success" as const,
  },
  {
    label: "Offline Devices",
    value: "56",
    helper: "Require heartbeat review",
    trend: "16%",
    icon: WifiOff,
    tone: "warning" as const,
  },
  {
    label: "Last Telemetry",
    value: "42s ago",
    helper: "Newest mock energy log",
    trend: "Live",
    icon: Clock3,
    tone: "success" as const,
  },
  {
    label: "System Alerts",
    value: "3",
    helper: "Mock warnings needing review",
    trend: "Non-critical",
    icon: AlertTriangle,
    tone: "warning" as const,
  },
];

const fleetRows = [
  {
    device: "WW-AC-001",
    owner: "maria@example.com",
    status: <AdminStatusBadge tone="success">Online</AdminStatusBadge>,
    lastSeen: "42 seconds ago",
    signal: "-54 dBm",
    health: <AdminStatusBadge tone="success">Healthy</AdminStatusBadge>,
  },
  {
    device: "WW-RF-018",
    owner: "juan@example.com",
    status: <AdminStatusBadge tone="success">Online</AdminStatusBadge>,
    lastSeen: "3 minutes ago",
    signal: "-61 dBm",
    health: <AdminStatusBadge tone="info">Stable</AdminStatusBadge>,
  },
  {
    device: "WW-TV-044",
    owner: "ana@example.com",
    status: <AdminStatusBadge tone="warning">Stale</AdminStatusBadge>,
    lastSeen: "27 minutes ago",
    signal: "-78 dBm",
    health: <AdminStatusBadge tone="warning">Watch</AdminStatusBadge>,
  },
  {
    device: "WW-OT-072",
    owner: "carlos@example.com",
    status: <AdminStatusBadge tone="danger">Offline</AdminStatusBadge>,
    lastSeen: "2 hours ago",
    signal: "No signal",
    health: <AdminStatusBadge tone="danger">Attention</AdminStatusBadge>,
  },
];

const fleetColumns = [
  { key: "device", header: "Device" },
  { key: "owner", header: "Owner" },
  { key: "status", header: "Status" },
  { key: "lastSeen", header: "Last Seen" },
  { key: "signal", header: "Signal", align: "right" as const },
  { key: "health", header: "Health" },
];

const alertRows = [
  {
    item: "Storage usage crossed planning marker",
    severity: <AdminStatusBadge tone="info">Info</AdminStatusBadge>,
    source: "Database",
    time: "Today, 11:12 AM",
  },
  {
    item: "12 devices have weak Wi-Fi signal",
    severity: <AdminStatusBadge tone="warning">Warning</AdminStatusBadge>,
    source: "Fleet",
    time: "Today, 10:28 AM",
  },
  {
    item: "4 devices offline for more than one hour",
    severity: <AdminStatusBadge tone="danger">Attention</AdminStatusBadge>,
    source: "Telemetry",
    time: "Today, 9:46 AM",
  },
];

const alertColumns = [
  { key: "item", header: "Health Signal" },
  { key: "severity", header: "Severity" },
  { key: "source", header: "Source" },
  { key: "time", header: "Time", align: "right" as const },
];

export default function AdminHealthPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={HeartPulse}
        title="System Health"
        description="Frontend preview for database storage, telemetry freshness, device fleet status, and operational alerts."
        actions={<AdminStatusBadge tone="warning">Mock Data</AdminStatusBadge>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {healthMetrics.map((metric) => (
          <AdminMetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <AdminSection
          title="Storage Monitor"
          description="Static preview for Supabase free-tier storage monitoring."
        >
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                  Estimated Usage
                </p>
                <p className="mt-2 text-3xl font-bold text-white">190 MB</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-mint/20 bg-mint/10 text-mint">
                <Server className="h-6 w-6" />
              </div>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[38%] rounded-full bg-mint" />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="font-bold text-white">38%</p>
                <p className="mt-1 text-xs text-white/40">Used</p>
              </div>
              <div>
                <p className="font-bold text-white">310 MB</p>
                <p className="mt-1 text-xs text-white/40">Remaining</p>
              </div>
              <div>
                <p className="font-bold text-white">80%</p>
                <p className="mt-1 text-xs text-white/40">Warning mark</p>
              </div>
            </div>
          </div>
        </AdminSection>

        <AdminSection
          title="Fleet Snapshot"
          description="Mock heartbeat distribution for paired ESP32-S3 devices."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-mint/25 bg-mint/10 p-4">
              <div className="mb-3 flex items-center gap-2 text-mint">
                <Wifi className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-wider">
                  Online
                </p>
              </div>
              <p className="text-3xl font-bold text-mint">286</p>
              <p className="mt-2 text-sm text-white/60">Recent heartbeat</p>
            </div>
            <div className="rounded-lg border border-naku/25 bg-naku/10 p-4">
              <div className="mb-3 flex items-center gap-2 text-naku">
                <Router className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-wider">
                  Stale
                </p>
              </div>
              <p className="text-3xl font-bold text-naku">18</p>
              <p className="mt-2 text-sm text-white/60">Delayed telemetry</p>
            </div>
            <div className="rounded-lg border border-danger/25 bg-danger/10 p-4">
              <div className="mb-3 flex items-center gap-2 text-danger">
                <WifiOff className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-wider">
                  Offline
                </p>
              </div>
              <p className="text-3xl font-bold text-danger">38</p>
              <p className="mt-2 text-sm text-white/60">Needs attention</p>
            </div>
          </div>
        </AdminSection>
      </div>

      <AdminSection
        title="Device Health Table"
        description="Mock device-level monitoring table for future fleet diagnostics."
      >
        <AdminTable columns={fleetColumns} rows={fleetRows} />
      </AdminSection>

      <AdminSection
        title="Operational Alerts"
        description="Mock alert stream for storage, telemetry, and fleet health signals."
      >
        <AdminTable columns={alertColumns} rows={alertRows} />
      </AdminSection>
    </div>
  );
}
