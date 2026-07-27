import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, writeAdminAudit } from "@/lib/admin-auth";
const roles = new Set(["user", "manager", "tenant", "super_admin"]);
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireAdminApi(); if ("response" in auth) return auth.response; const { userId } = await params; if (userId === auth.user.id) return NextResponse.json({ error: "You cannot modify your own admin account" }, { status: 400 });
  const body = await request.json(); const { data: before, error: readError } = await auth.admin.from("profiles").select("*").eq("id", userId).single(); if (readError || !before) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const update: Record<string, unknown> = {}; if (body.role !== undefined) { if (!roles.has(body.role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 }); update.role = body.role; } if (body.manager_id !== undefined) update.manager_id = body.manager_id || null; if (body.must_update_password !== undefined) update.must_update_password = Boolean(body.must_update_password);
  const disabling = body.disabled !== undefined; if (disabling) { update.disabled_at = body.disabled ? new Date().toISOString() : null; update.disabled_reason = body.disabled ? String(body.disabled_reason || "Admin action").slice(0, 500) : null; }
  if (Object.keys(update).length) { const result = await auth.admin.from("profiles").update(update).eq("id", userId); if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 }); }
  if (disabling) { const result = await auth.admin.auth.admin.updateUserById(userId, { ban_duration: body.disabled ? "876000h" : "none" }); if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 }); }
  const { data: after } = await auth.admin.from("profiles").select("*").eq("id", userId).single(); await writeAdminAudit(auth.admin, { actorId: auth.user.id, action: disabling ? (body.disabled ? "account_disable" : "account_enable") : "user_update", targetType: "user", targetId: userId, reason: body.reason || body.disabled_reason, beforeState: before, afterState: after }); return NextResponse.json({ data: after });
}
