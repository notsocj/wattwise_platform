import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function requireAdminApi() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  const { data: profile } = await supabase.from("profiles").select("id, role, email, full_name").eq("id", user.id).single();
  if (profile?.role !== "super_admin") return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  try { return { user, profile, admin: createAdminClient() } as const; }
  catch { return { response: NextResponse.json({ error: "Admin service is not configured" }, { status: 503 }) } as const; }
}

export async function writeAdminAudit(admin: ReturnType<typeof createAdminClient>, input: { actorId: string; action: string; targetType: string; targetId?: string | null; reason?: string | null; beforeState?: unknown; afterState?: unknown; }) {
  await admin.from("admin_audit_logs").insert({ actor_id: input.actorId, action: input.action, target_type: input.targetType, target_id: input.targetId ?? null, reason: input.reason ?? null, before_state: input.beforeState ?? null, after_state: input.afterState ?? null });
}
