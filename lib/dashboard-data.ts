import "server-only";

import { hasMissingRelayStateColumnError } from "@/lib/device-telemetry";
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type DashboardDeviceRow = {
  id: string;
  device_name: string;
  mac_address: string;
  is_online: boolean | null;
  appliance_type: string | null;
  relay_state: boolean | null;
  budget_status: string | null;
  owner_id: string | null;
  tenant_id: string | null;
  user_approved_limit_php: number | string | null;
};

export type OwnedDeviceRow = {
  id: string;
  device_name: string;
  mac_address: string;
  relay_state: boolean | null;
  owner_id: string | null;
  tenant_id: string | null;
  user_approved_limit_php: number | string | null;
  budget_status: string | null;
};

export async function fetchDashboardDevices(
  supabase: SupabaseServerClient,
  userId: string
): Promise<DashboardDeviceRow[]> {
  const accessFilter = `owner_id.eq.${userId},user_id.eq.${userId},tenant_id.eq.${userId}`;
  const withRelayState = await supabase
    .from("devices")
    .select("id, device_name, mac_address, is_online, appliance_type, relay_state, budget_status, owner_id, tenant_id, user_approved_limit_php")
    .or(accessFilter)
    .order("created_at", { ascending: true });

  if (!withRelayState.error) {
    return (withRelayState.data ?? []) as DashboardDeviceRow[];
  }

  if (!hasMissingRelayStateColumnError(withRelayState.error)) {
    return [];
  }

  const withoutRelayState = await supabase
    .from("devices")
    .select("id, device_name, mac_address, is_online, appliance_type, owner_id, tenant_id, user_approved_limit_php")
    .or(accessFilter)
    .order("created_at", { ascending: true });

  if (withoutRelayState.error) {
    return [];
  }

  return (withoutRelayState.data ?? []).map((device) => ({
    ...device,
    relay_state: true,
    budget_status: "ok",
  })) as DashboardDeviceRow[];
}

export async function fetchOwnedDeviceById(
  supabase: SupabaseServerClient,
  userId: string,
  deviceId: string,
  role: string | null | undefined
): Promise<OwnedDeviceRow | null> {
  const accessFilter =
    role === "tenant"
      ? `tenant_id.eq.${userId}`
      : `owner_id.eq.${userId},user_id.eq.${userId}`;
  const withRelayState = await supabase
    .from("devices")
    .select("id, device_name, mac_address, relay_state, owner_id, tenant_id, user_approved_limit_php, budget_status")
    .eq("id", deviceId)
    .or(accessFilter)
    .maybeSingle<OwnedDeviceRow>();

  if (!withRelayState.error) {
    return withRelayState.data ?? null;
  }

  if (!hasMissingRelayStateColumnError(withRelayState.error)) {
    return null;
  }

  const withoutRelayState = await supabase
    .from("devices")
    .select("id, device_name, mac_address, owner_id, tenant_id, user_approved_limit_php, budget_status")
    .eq("id", deviceId)
    .or(accessFilter)
    .maybeSingle<Omit<OwnedDeviceRow, "relay_state">>();

  if (withoutRelayState.error || !withoutRelayState.data) {
    return null;
  }

  return {
    ...withoutRelayState.data,
    relay_state: true,
  };
}
