import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const rawBillingCycleStartDay = (body as { billing_cycle_start_day?: unknown })
    .billing_cycle_start_day;
  const billingCycleStartDay =
    typeof rawBillingCycleStartDay === "number" ? rawBillingCycleStartDay : Number.NaN;

  if (
    !Number.isInteger(billingCycleStartDay) ||
    billingCycleStartDay < 1 ||
    billingCycleStartDay > 28
  ) {
    return NextResponse.json(
      { error: "billing_cycle_start_day must be an integer from 1 to 28." },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("profiles")
    .update({ billing_cycle_start_day: billingCycleStartDay })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to save billing cycle start day." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    billing_cycle_start_day: billingCycleStartDay,
  });
}
