import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
export async function GET(request: NextRequest) {
  const auth = await requireAdminApi(); if ("response" in auth) return auth.response; const p = request.nextUrl.searchParams; const page = Math.max(1, Number(p.get("page") || 1)); const size = Math.min(100, Math.max(1, Number(p.get("pageSize") || 50))); const from = (page - 1) * size; let q = auth.admin.from("admin_audit_logs").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, from + size - 1); for (const key of ["action", "target_type", "target_id", "actor_id"]) { const value = p.get(key); if (value) q = q.eq(key, value); } const { data, error, count } = await q; if (error) return NextResponse.json({ error: error.message }, { status: 500 }); return NextResponse.json({ data: data ?? [], page, pageSize: size, total: count ?? 0 });
}
