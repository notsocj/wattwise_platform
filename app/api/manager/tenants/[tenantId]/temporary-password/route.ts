import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-context";
import { createAdminClient, hasAdminClientConfig } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateTempPassword } from "@/lib/temp-password";

/**
 * Issues a fresh temporary password for one of the manager's tenants who has
 * not set their own password yet. Passwords are only stored hashed, so the
 * original one cannot be shown again; this replaces it.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null }>();
  if (profile?.role !== "manager") {
    return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  }
  if (!hasAdminClientConfig()) {
    return NextResponse.json({ error: "Temporary passwords aren't available right now." }, { status: 500 });
  }

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("profiles")
    .select("id,email,must_update_password")
    .eq("id", tenantId)
    .eq("role", "tenant")
    .eq("manager_id", user.id)
    .maybeSingle<{ id: string; email: string; must_update_password: boolean | null }>();

  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  if (!tenant.must_update_password) {
    return NextResponse.json(
      { error: "This tenant already set their own password. They can reset it from the login page." },
      { status: 409 }
    );
  }

  const password = generateTempPassword();
  const { error } = await admin.auth.admin.updateUserById(tenant.id, { password });
  if (error) {
    return NextResponse.json({ error: "Could not create a temporary password. Try again." }, { status: 500 });
  }

  return NextResponse.json({ email: tenant.email, temporary_password: password });
}
