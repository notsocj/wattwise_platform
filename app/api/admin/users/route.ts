import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
export async function GET(request: NextRequest) {
  const auth = await requireAdminApi(); if ("response" in auth) return auth.response;
  const p = request.nextUrl.searchParams; const page = Math.max(1, Number(p.get("page") || 1)); const pageSize = Math.min(100, Math.max(1, Number(p.get("pageSize") || 25))); const from = (page - 1) * pageSize;
  let query = auth.admin.from("profiles").select("id,email,full_name,role,manager_id,must_update_password,disabled_at,disabled_reason,created_at", { count: "exact" }).order("created_at", { ascending: false }).range(from, from + pageSize - 1);
  const q = p.get("q")?.trim(); if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`); const role = p.get("role"); if (role) query = query.eq("role", role); const status = p.get("status"); if (status === "disabled") query = query.not("disabled_at", "is", null); if (status === "active") query = query.is("disabled_at", null);
  const { data, error, count } = await query; if (error) return NextResponse.json({ error: error.message }, { status: 500 }); return NextResponse.json({ data: data ?? [], page, pageSize, total: count ?? 0 });
}
