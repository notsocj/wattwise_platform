import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, writeAdminAudit } from "@/lib/admin-auth";
import { parseRateInput } from "@/lib/meralco-rate-input";
import { MERALCO_RATE_SELECT } from "@/lib/meralco-rates";
import { MERALCO_RATES_CACHE_TAG } from "@/lib/meralco-rates-server";

/**
 * Creates or corrects one month of Meralco rates (super admin only). The row
 * is marked as a manual entry; the monthly sync replaces it if Meralco later
 * publishes that month. Every save is audited with the before and after rows.
 */
export async function POST(request: NextRequest) {
  const context = await requireAdminApi();
  if ("response" in context) return context.response;
  const { admin, user } = context;

  const parsed = parseRateInput(await request.json().catch(() => null));
  if ("errors" in parsed) {
    return NextResponse.json({ error: "Fix the highlighted fields.", fields: parsed.errors }, { status: 400 });
  }
  const { row, reason } = parsed;

  const { data: before } = await admin
    .from("meralco_rates")
    .select(MERALCO_RATE_SELECT)
    .eq("effective_month", row.effective_month)
    .maybeSingle();

  const { data: after, error } = await admin
    .from("meralco_rates")
    .upsert(
      { ...row.values, effective_month: row.effective_month, auto_updated: false, source_url: null, source_pdf_url: null, fetched_at: null },
      { onConflict: "effective_month" }
    )
    .select(MERALCO_RATE_SELECT)
    .single();

  if (error || !after) {
    console.error("admin rate save error", error);
    return NextResponse.json({ error: "Could not save these rates. Try again." }, { status: 500 });
  }

  await writeAdminAudit(admin, {
    actorId: user.id,
    action: before ? "meralco_rates_update" : "meralco_rates_create",
    targetType: "meralco_rates",
    targetId: row.effective_month,
    reason,
    beforeState: before,
    afterState: after,
  });

  // Every bill, budget, and report reads rates through this cache.
  revalidateTag(MERALCO_RATES_CACHE_TAG, { expire: 0 });

  return NextResponse.json({ ok: true, created: !before, rates: after });
}
