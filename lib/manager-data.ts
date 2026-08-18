import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBillingCycle, getManilaDayKey } from "@/lib/date-utils";
import { getBudgetProgressPercent } from "@/lib/budget-policy";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type ManagerProfile = {
  role: string | null;
  email: string | null;
  full_name: string | null;
  billing_cycle_start_day: number | null;
};

export type ManagerTenant = {
  id: string;
  email: string;
  full_name: string | null;
  must_update_password: boolean | null;
  created_at: string | null;
};

export type ManagerDevice = {
  id: string;
  device_name: string;
  mac_address: string;
  tenant_id: string | null;
  tenant_label: string;
  tenant_email: string | null;
  user_approved_limit_php: number;
  require_approval_on_expiry: boolean;
  relay_state: boolean;
  budget_status: string | null;
  watts: number;
  volts: number;
  amps: number;
  energy_kwh: number;
  recorded_at: string | null;
  is_stale: boolean;
  spend_php: number;
  progress_percent: number;
};

export type ManagerFleetSnapshot = {
  devices: ManagerDevice[];
  tenants: ManagerTenant[];
  billingCycle: {
    startDate: Date;
    endDate: Date;
    startKey: string;
    endKey: string;
    elapsedDays: number;
    totalDays: number;
  };
  totals: {
    spend_php: number;
    limit_php: number;
    active_relays: number;
    offline_rooms: number;
    assigned_rooms: number;
    vacant_rooms: number;
    rooms_at_risk: number;
  };
};

type RawDeviceRow = {
  id: string;
  device_name: string;
  mac_address: string;
  tenant_id: string | null;
  user_approved_limit_php: number | string | null;
  require_approval_on_expiry: boolean | null;
  relay_state: boolean | null;
  budget_status: string | null;
};

type LatestReadingRow = {
  device_id: string;
  average_watts: number | string | null;
  voltage_v: number | string | null;
  current_a: number | string | null;
  energy_kwh: number | string | null;
  recorded_at: string | null;
};

type DeviceMonthUsageRow = {
  device_id: string;
  variable_spend_php: number | string;
};

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isStaleReading(recordedAt: string | null, now: Date): boolean {
  if (!recordedAt) {
    return true;
  }

  const recordedTime = new Date(recordedAt).getTime();
  if (!Number.isFinite(recordedTime)) {
    return true;
  }

  return now.getTime() - recordedTime > 20_000;
}

export async function getManagerSession(): Promise<{
  supabase: SupabaseServerClient;
  user: User;
  profile: ManagerProfile;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email, full_name, billing_cycle_start_day")
    .eq("id", user.id)
    .maybeSingle<ManagerProfile>();

  if (profile?.role !== "manager") {
    return null;
  }

  return { supabase, user, profile };
}

export async function requireManagerPage() {
  const session = await getManagerSession();

  if (!session) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    redirect(user ? "/dashboard" : "/login");
  }

  return session;
}

export async function getManagerFleetSnapshot(
  supabase: SupabaseServerClient,
  managerId: string,
  billingCycleStartDay: number
): Promise<ManagerFleetSnapshot> {
  const now = new Date();
  const billingCycle = getCurrentBillingCycle(billingCycleStartDay, now);
  const startKey = getManilaDayKey(billingCycle.startDate);
  const endKey = getManilaDayKey(billingCycle.endDate);

  const [tenantsRes, devicesRes, latestReadingsRes, monthUsageRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, full_name, must_update_password, created_at")
        .eq("manager_id", managerId)
        .eq("role", "tenant")
        .order("created_at", { ascending: false }),
      supabase
        .from("devices")
        .select(
          "id, device_name, mac_address, tenant_id, user_approved_limit_php, require_approval_on_expiry, relay_state, budget_status"
        )
        .eq("owner_id", managerId)
        .order("created_at", { ascending: true }),
      supabase.rpc("get_latest_device_readings", { p_user_id: managerId }),
      supabase
        .from("device_month_usage")
        .select("device_id, variable_spend_php")
        .eq("month_start", startKey),
    ]);

  const tenants = (tenantsRes.data ?? []) as ManagerTenant[];
  const tenantMap = new Map(tenants.map((tenant) => [tenant.id, tenant]));
  const latestByDevice = new Map<string, LatestReadingRow>();

  for (const row of (latestReadingsRes.data ?? []) as LatestReadingRow[]) {
    latestByDevice.set(row.device_id, row);
  }

  const spendByDevice = new Map(
    ((monthUsageRes.data ?? []) as DeviceMonthUsageRow[]).map((row) => [
      row.device_id,
      Math.max(0, toNumber(row.variable_spend_php)),
    ])
  );

  const devices = ((devicesRes.data ?? []) as RawDeviceRow[]).map((device) => {
    const latest = latestByDevice.get(device.id);
    const watts = Math.max(0, toNumber(latest?.average_watts));
    const volts = Math.max(0, toNumber(latest?.voltage_v));
    const derivedVolts = volts > 0 ? volts : 230;
    const amps = Math.max(
      0,
      toNumber(latest?.current_a) || (derivedVolts > 0 ? watts / derivedVolts : 0)
    );
    const limit = Math.max(0, toNumber(device.user_approved_limit_php));
    const spend = spendByDevice.get(device.id) ?? 0;
    const tenant = device.tenant_id ? tenantMap.get(device.tenant_id) : null;

    return {
      id: device.id,
      device_name: device.device_name,
      mac_address: device.mac_address,
      tenant_id: device.tenant_id,
      tenant_label: tenant?.full_name || tenant?.email || "Vacant",
      tenant_email: tenant?.email ?? null,
      user_approved_limit_php: limit,
      require_approval_on_expiry: device.require_approval_on_expiry === true,
      relay_state: device.relay_state !== false,
      budget_status: device.budget_status,
      watts,
      volts: derivedVolts,
      amps,
      energy_kwh: Math.max(0, toNumber(latest?.energy_kwh)),
      recorded_at: latest?.recorded_at ?? null,
      is_stale: isStaleReading(latest?.recorded_at ?? null, now),
      spend_php: spend,
      progress_percent: getBudgetProgressPercent(spend, limit),
    };
  });

  const totals = devices.reduce(
    (summary, device) => ({
      spend_php: summary.spend_php + device.spend_php,
      limit_php: summary.limit_php + device.user_approved_limit_php,
      active_relays: summary.active_relays + (device.relay_state ? 1 : 0),
      offline_rooms: summary.offline_rooms + (device.is_stale ? 1 : 0),
      assigned_rooms: summary.assigned_rooms + (device.tenant_id ? 1 : 0),
      vacant_rooms: summary.vacant_rooms + (device.tenant_id ? 0 : 1),
      rooms_at_risk:
        summary.rooms_at_risk +
        (device.user_approved_limit_php > 0 &&
        device.spend_php / device.user_approved_limit_php >= 0.8
          ? 1
          : 0),
    }),
    {
      spend_php: 0,
      limit_php: 0,
      active_relays: 0,
      offline_rooms: 0,
      assigned_rooms: 0,
      vacant_rooms: 0,
      rooms_at_risk: 0,
    }
  );

  return {
    devices,
    tenants,
    billingCycle: {
      startDate: billingCycle.startDate,
      endDate: billingCycle.endDate,
      startKey,
      endKey,
      elapsedDays: billingCycle.elapsedDays,
      totalDays: billingCycle.totalDays,
    },
    totals,
  };
}
