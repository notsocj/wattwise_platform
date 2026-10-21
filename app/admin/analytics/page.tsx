import { Globe } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { isFreshReading } from "@/lib/device-telemetry";

// Billing cycles start on any day of the month, so every device's current
// cycle started within the last 31 days.
const CURRENT_CYCLE_LOOKBACK_DAYS = 31;

function getLookbackStartDate(): string {
  return new Date(Date.now() - CURRENT_CYCLE_LOOKBACK_DAYS * 86400000).toISOString().slice(0, 10);
}

export default async function AdminAnalyticsPage() {
  const admin = createAdminClient();
  const lookbackStart = getLookbackStartDate();

  const [{ data: usageRows }, { data: devices }] = await Promise.all([
    // energy_kwh is a cumulative meter reading, so totals come from the
    // trigger-maintained per-cycle accumulator rather than summing raw logs.
    admin
      .from("device_month_usage")
      .select("device_id,month_start,usage_kwh")
      .gte("month_start", lookbackStart)
      .order("month_start", { ascending: false }),
    admin.from("devices").select("appliance_type,last_seen_at"),
  ]);

  const currentCycleKwh = new Map<string, number>();
  for (const row of usageRows ?? []) {
    if (!currentCycleKwh.has(row.device_id)) {
      currentCycleKwh.set(row.device_id, Number(row.usage_kwh) || 0);
    }
  }
  const kwh = [...currentCycleKwh.values()].reduce((sum, value) => sum + value, 0);
  const activeDevices = (devices ?? []).filter((device) => isFreshReading(device.last_seen_at)).length;
  const applianceTypes = new Set(
    (devices ?? []).map((device) => device.appliance_type).filter(Boolean)
  ).size;

  const stats = [
    { label: "kWh (current billing cycles)", value: kwh.toFixed(2) },
    { label: "Active devices", value: activeDevices },
    { label: "Appliance types", value: applianceTypes },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Globe className="h-6 w-6 text-mint" />
        <h1 className="text-2xl font-bold">Global Analytics</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-white/10 bg-surface p-5">
            <p className="text-sm text-white/50">{stat.label}</p>
            <p className="mt-2 text-3xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
