import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();

  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null }>();

  if (profile?.role === "tenant") {
    return NextResponse.json(
      { error: "Tenants cannot edit billing cycle settings." },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    billing_cycle_start_day?: unknown;
    meralco_monthly_kwh?: unknown;
  };
  const update: { billing_cycle_start_day?: number; meralco_monthly_kwh?: number | null } = {};

  if ("billing_cycle_start_day" in body) {
    const day = typeof body.billing_cycle_start_day === "number" ? body.billing_cycle_start_day : Number.NaN;
    if (!Number.isInteger(day) || day < 1 || day > 28) {
      return NextResponse.json(
        { error: "Choose a billing start date from 1 to 28." },
        { status: 400 }
      );
    }
    update.billing_cycle_start_day = day;
  }

  // Monthly kWh from the homeowner's Meralco bill; null clears it. It picks
  // the distribution tier and energy tax (see migration 038).
  if ("meralco_monthly_kwh" in body) {
    const kwh = body.meralco_monthly_kwh;
    if (kwh === null) {
      update.meralco_monthly_kwh = null;
    } else if (typeof kwh === "number" && Number.isFinite(kwh) && kwh > 0 && kwh <= 100000) {
      update.meralco_monthly_kwh = Math.round(kwh * 100) / 100;
    } else {
      return NextResponse.json(
        { error: "Enter your monthly kWh as a number from 1 to 100,000, or clear it." },
        { status: 400 }
      );
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "We could not save your billing settings right now." },
      { status: 500 }
    );
  }

  return NextResponse.json(update);
}
