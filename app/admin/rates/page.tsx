import { DollarSign } from "@/components/ui/icons";
import { AdminPageHeader } from "@/components/admin/AdminUi";
import RateEditor from "@/components/admin/RateEditor";
import { createAdminClient } from "@/lib/supabase/admin";
import { MERALCO_RATE_SELECT, type MeralcoRatesRow } from "@/lib/meralco-rates";

export default async function AdminRatesPage() {
  const { data } = await createAdminClient()
    .from("meralco_rates")
    .select(MERALCO_RATE_SELECT)
    .order("effective_month", { ascending: false })
    .limit(24)
    .returns<MeralcoRatesRow[]>();

  return (
    <div>
      <AdminPageHeader
        icon={DollarSign}
        title="Meralco Rates"
        description="Rates sync from Meralco each month. Add a month the sync missed, or correct one; every change is audited."
      />
      <RateEditor rows={data ?? []} />
    </div>
  );
}
