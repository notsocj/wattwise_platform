import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { toIlikeSearchTerm } from "@/lib/postgrest";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;

  const p = request.nextUrl.searchParams;
  const page = Math.max(1, Number(p.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(p.get("pageSize") || 25)));
  const from = (page - 1) * pageSize;

  let query = auth.admin
    .from("devices")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  const q = toIlikeSearchTerm(p.get("q"));
  if (q) query = query.or(`device_name.ilike.%${q}%,mac_address.ilike.%${q}%`);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const devices = data ?? [];

  // energy_logs.device_id holds either devices.id or the legacy MAC address.
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const latestTelemetry = await Promise.all(
    devices.map(async (device) => {
      const keys = [device.id, device.mac_address].filter(
        (key): key is string => typeof key === "string" && key.length > 0
      );
      const { data: rows } = await auth.admin
        .from("energy_logs")
        .select("device_id,energy_kwh,average_watts,voltage_v,current_a,recorded_at")
        .in("device_id", keys)
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: false })
        .limit(1);
      return rows?.[0] ?? null;
    })
  );

  return NextResponse.json({
    data: devices.map((device, index) => ({ ...device, latest_telemetry: latestTelemetry[index] })),
    page,
    pageSize,
    total: count ?? 0,
  });
}
