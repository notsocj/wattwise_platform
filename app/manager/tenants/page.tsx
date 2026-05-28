import ManagerTenantsClient from "@/components/manager/ManagerTenantsClient";
import { getManagerFleetSnapshot, requireManagerPage } from "@/lib/manager-data";

export default async function ManagerTenantsPage() {
  const { supabase, user, profile } = await requireManagerPage();
  const snapshot = await getManagerFleetSnapshot(
    supabase,
    user.id,
    profile.billing_cycle_start_day ?? 1
  );

  return (
    <ManagerTenantsClient devices={snapshot.devices} tenants={snapshot.tenants} />
  );
}
