import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/server";

/** Cancel a scheduled turn-off. cancel_device_automation checks the caller owns the device. */
export async function DELETE(
  _request: NextRequest,
  props: { params: Promise<{ deviceId: string; automationId: string }> }
) {
  const { automationId } = await props.params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data: cancelled, error } = await supabase.rpc("cancel_device_automation", {
    p_automation_id: automationId,
  });
  if (error) return NextResponse.json({ error: "Couldn't cancel it. Try again." }, { status: 400 });
  if (!cancelled) {
    return NextResponse.json({ error: "It already ran, ended, or was cancelled." }, { status: 404 });
  }
  return NextResponse.json({ status: "cancelled" });
}
