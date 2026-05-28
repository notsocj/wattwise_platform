import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, hasAdminClientConfig } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  const body = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `${body}!7`;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null }>();

  if (profile?.role !== "manager") {
    return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: unknown;
    full_name?: unknown;
  };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Tenant email is required." }, { status: 400 });
  }

  if (!hasAdminClientConfig()) {
    return NextResponse.json(
      {
        error:
          "Tenant creation needs SUPABASE_SERVICE_ROLE_KEY in your server environment.",
      },
      { status: 500 }
    );
  }

  const password = generateTempPassword();
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      {
        error:
          "Tenant creation needs SUPABASE_SERVICE_ROLE_KEY in your server environment.",
      },
      { status: 500 }
    );
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName || email,
      manager_id: user.id,
      role: "tenant",
    },
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create tenant account." },
      { status: 400 }
    );
  }

  const { error: profileError } = await admin
    .from("profiles")
    .upsert({
      id: data.user.id,
      email,
      full_name: fullName || null,
      role: "tenant",
      manager_id: user.id,
      must_update_password: true,
    });

  if (profileError) {
    return NextResponse.json(
      { error: "Tenant account was created, but profile setup failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    tenant: {
      id: data.user.id,
      email,
      full_name: fullName || null,
    },
    temporary_password: password,
  });
}
