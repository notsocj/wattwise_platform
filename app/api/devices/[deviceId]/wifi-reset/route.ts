import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Ask the unit to forget its Wi-Fi; it picks this up on its next poll (migration 046). */
export async function POST(_request: Request, props: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await props.params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null }>();
  if (profile?.role === "tenant") {
    return NextResponse.json({ error: "Tenants can't reset a unit's Wi-Fi." }, { status: 403 });
  }

  const { data: device } = await supabase
    .from("devices")
    .select("id")
    .eq("id", deviceId)
    .or(`owner_id.eq.${user.id},user_id.eq.${user.id}`)
    .maybeSingle();
  if (!device) return NextResponse.json({ error: "Device not found or not owned by you" }, { status: 404 });

  const { data: demo } = await createAdminClient()
    .from("demo_device_simulations")
    .select("device_id")
    .eq("device_id", deviceId)
    .maybeSingle();
  if (demo) return NextResponse.json({ error: "Demo units have no Wi-Fi to reset." }, { status: 409 });

  const requestedAt = new Date().toISOString();
  const { error } = await supabase.from("devices").update({ wifi_reset_requested_at: requestedAt }).eq("id", deviceId);
  if (error) return NextResponse.json({ error: "We couldn't send the reset. Try again." }, { status: 500 });

  return NextResponse.json({ requested_at: requestedAt });
}
