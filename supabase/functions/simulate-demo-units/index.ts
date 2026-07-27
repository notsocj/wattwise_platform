import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DemoRow = {
  device_id: string;
  is_active: boolean;
  simulated_watts: number;
  simulated_voltage_v: number;
  energy_kwh: number;
  last_generated_at: string | null;
  devices: { mac_address: string } | null;
};

function isServiceRoleRequest(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const payload = token.split(".")[1];
  if (!payload) return false;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(normalized)) as { role?: string };
    return claims.role === "service_role";
  } catch {
    return false;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  if (!isServiceRoleRequest(request)) return Response.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return Response.json({ error: "Missing Supabase configuration" }, { status: 500, headers: corsHeaders });

  const client = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const payload = await request.json().catch(() => ({}));
  const requestedDeviceId = typeof payload.device_id === "string" ? payload.device_id : null;
  let query = client.from("demo_device_simulations").select("device_id,is_active,simulated_watts,simulated_voltage_v,energy_kwh,last_generated_at,devices(mac_address)").eq("is_active", true);
  if (requestedDeviceId) query = query.eq("device_id", requestedDeviceId);
  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });

  const now = new Date();
  const results = [];
  for (const row of (data ?? []) as DemoRow[]) {
    if (!row.devices?.mac_address) continue;
    const previous = row.last_generated_at ? new Date(row.last_generated_at) : new Date(now.getTime() - 60_000);
    const elapsedSeconds = Math.max(1, Math.min(600, (now.getTime() - previous.getTime()) / 1000));
    const nextEnergy = Number((Number(row.energy_kwh) + (Number(row.simulated_watts) * elapsedSeconds) / 3_600_000).toFixed(4));
    const voltage = Number(row.simulated_voltage_v);
    const current = voltage > 0 ? Number((Number(row.simulated_watts) / voltage).toFixed(2)) : 0;
    const { error: insertError } = await client.from("energy_logs").insert({
      device_id: row.devices.mac_address,
      energy_kwh: nextEnergy,
      average_watts: row.simulated_watts,
      voltage_v: voltage,
      current_a: current,
      recorded_at: now.toISOString(),
    });
    if (insertError) { results.push({ device_id: row.device_id, error: insertError.message }); continue; }
    await client.from("demo_device_simulations").update({ energy_kwh: nextEnergy, last_generated_at: now.toISOString(), updated_at: now.toISOString() }).eq("device_id", row.device_id);
    await client.from("devices").update({ is_online: true, last_seen_at: now.toISOString() }).eq("id", row.device_id);
    results.push({ device_id: row.device_id, energy_kwh: nextEnergy, watts: row.simulated_watts });
  }
  return Response.json({ generated_at: now.toISOString(), results }, { headers: corsHeaders });
});
