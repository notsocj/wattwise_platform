import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
export async function GET(request: NextRequest) {
  const auth = await requireAdminApi(); if ("response" in auth) return auth.response; const p = request.nextUrl.searchParams; const page = Math.max(1, Number(p.get("page") || 1)); const pageSize = Math.min(100, Math.max(1, Number(p.get("pageSize") || 25))); const from = (page - 1) * pageSize;
  let query = auth.admin.from("devices").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, from + pageSize - 1); const q = p.get("q")?.trim(); if (q) query = query.or(`device_name.ilike.%${q}%,mac_address.ilike.%${q}%`);
  const { data, error, count } = await query; if (error) return NextResponse.json({ error: error.message }, { status: 500 }); const devices = data ?? []; const ids = devices.map((d) => d.id);
  const { data: logs } = ids.length ? await auth.admin.from("energy_logs").select("device_id,energy_kwh,average_watts,voltage_v,current_a,recorded_at").in("device_id", ids).gte("recorded_at", new Date(Date.now() - 7 * 86400000).toISOString()).order("recorded_at", { ascending: false }).limit(5000) : { data: [] };
  const latest = new Map<string, unknown>(); for (const row of logs ?? []) if (!latest.has(row.device_id)) latest.set(row.device_id, row);
  return NextResponse.json({ data: devices.map((d) => ({ ...d, latest_telemetry: latest.get(d.id) ?? null })), page, pageSize, total: count ?? 0 });
}
