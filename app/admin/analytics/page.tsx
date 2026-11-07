import { Globe } from "@/components/ui/icons";
import AdminChart from "@/components/admin/AdminChart";
import { AdminPageHeader, AdminSection, StatCard, lastManilaDays, shortDayLabel } from "@/components/admin/AdminUi";
import { isFreshReading } from "@/lib/device-telemetry";
import { formatPeso } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

// Billing cycles start on any day of the month, so every device's current
// cycle started within the last 31 days.
const CURRENT_CYCLE_LOOKBACK_DAYS = 31;
const CHART_DAYS = 30;

type UsageRow = { device_id: string; month_start: string; usage_kwh: number | string; variable_spend_php: number | string | null };
type DeviceRow = { id: string; appliance_type: string | null; last_seen_at: string | null };
type DailyRow = { day_key: string; usage_kwh: number | string };

export default async function AdminAnalyticsPage() {
  const admin = createAdminClient();
  const now = new Date().getTime();
  const lookbackStart = new Date(now - CURRENT_CYCLE_LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);

  const [usage, devices, daily] = await Promise.all([
    // energy_kwh is a cumulative meter reading, so totals come from the
    // trigger-maintained per-cycle accumulator, never from summing raw logs.
    admin.from("device_month_usage").select("device_id,month_start,usage_kwh,variable_spend_php").order("month_start", { ascending: false }).returns<UsageRow[]>(),
    admin.from("devices").select("id,appliance_type,last_seen_at").returns<DeviceRow[]>(),
    admin.rpc("admin_platform_daily_kwh", {
      p_start: new Date(now - CHART_DAYS * 86_400_000).toISOString(),
      p_end: new Date(now).toISOString(),
    }),
  ]);

  const usageRows = usage.data ?? [];
  const allTimeKwh = usageRows.reduce((sum, row) => sum + (Number(row.usage_kwh) || 0), 0);
  const allTimeSpend = usageRows.reduce((sum, row) => sum + (Number(row.variable_spend_php) || 0), 0);

  // Rows are newest first, so the first row per device is its current cycle.
  const currentCycle = new Map<string, number>();
  for (const row of usageRows) {
    if (row.month_start >= lookbackStart && !currentCycle.has(row.device_id)) currentCycle.set(row.device_id, Number(row.usage_kwh) || 0);
  }
  const cycleKwh = [...currentCycle.values()].reduce((sum, value) => sum + value, 0);

  const fleet = devices.data ?? [];
  const activeDevices = fleet.filter((device) => isFreshReading(device.last_seen_at, now)).length;
  const byType = new Map<string, { units: number; kwh: number }>();
  for (const device of fleet) {
    const type = device.appliance_type?.trim() || "Unspecified";
    const total = byType.get(type) ?? { units: 0, kwh: 0 };
    byType.set(type, { units: total.units + 1, kwh: total.kwh + (currentCycle.get(device.id) ?? 0) });
  }
  const types = [...byType.entries()].sort((a, b) => b[1].kwh - a[1].kwh || b[1].units - a[1].units);
  const maxTypeKwh = Math.max(...types.map(([, total]) => total.kwh), 0);

  const dailyMap = new Map(((daily.data as DailyRow[] | null) ?? []).map((row) => [row.day_key, Number(row.usage_kwh) || 0]));
  const days = lastManilaDays(CHART_DAYS);
  const chart = days.map((day) => ({ label: shortDayLabel(day), value: Number((dailyMap.get(day) ?? 0).toFixed(3)) }));
  // Compare the last 7 full days with the 7 before them (today is still running).
  const sumDays = (keys: string[]) => keys.reduce((sum, key) => sum + (dailyMap.get(key) ?? 0), 0);
  const lastWeek = sumDays(days.slice(-8, -1));
  const weekBefore = sumDays(days.slice(-15, -8));
  const weekChange = weekBefore > 0 ? ((lastWeek - weekBefore) / weekBefore) * 100 : null;

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={Globe} title="Global Analytics" description="Energy monitored across every WattWise unit." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="kWh monitored" value={allTimeKwh.toFixed(1)} hint="All time, every unit" tone="good" />
        <StatCard label="Spend tracked" value={formatPeso(allTimeSpend)} hint="Variable Meralco charges, all time" />
        <StatCard label="This billing cycle" value={`${cycleKwh.toFixed(1)} kWh`} hint={`${activeDevices} of ${fleet.length} units online now`} />
        <StatCard
          label="Week over week"
          value={weekChange === null ? "—" : `${weekChange > 0 ? "+" : ""}${weekChange.toFixed(1)}%`}
          hint={weekChange === null ? "Needs two weeks of readings" : `${lastWeek.toFixed(1)} kWh last 7 days vs ${weekBefore.toFixed(1)}`}
          tone={weekChange === null ? "default" : weekChange <= 0 ? "good" : "warning"}
        />
      </div>

      <AdminSection title="Platform energy use" description={`kWh per day across all units, last ${CHART_DAYS} days (Manila time).`}>
        {daily.error ? (
          <p className="text-sm text-danger">Daily usage is unavailable ({daily.error.message}).</p>
        ) : (
          <AdminChart data={chart} kind="area" valueLabel="kWh" format="kwh" />
        )}
      </AdminSection>

      <AdminSection title="By appliance type" description="Units and kWh this billing cycle.">
        {types.length === 0 ? (
          <p className="text-sm text-fg/50">No units registered yet.</p>
        ) : (
          <ul className="space-y-3">
            {types.map(([type, total]) => (
              <li key={type}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium capitalize">{type}</span>
                  <span className="tabular-nums text-fg/60">
                    {total.kwh.toFixed(2)} kWh · {total.units} unit{total.units === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fg/[0.06]">
                  <div className="h-full rounded-full bg-mint" style={{ width: `${maxTypeKwh > 0 ? Math.max((total.kwh / maxTypeKwh) * 100, 2) : 2}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>
    </div>
  );
}
