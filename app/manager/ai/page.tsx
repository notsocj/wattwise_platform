import ManagerAiClient from "@/components/manager/ManagerAiClient";
import { getManagerFleetSnapshot, requireManagerPage } from "@/lib/manager-data";

export default async function ManagerAiPage() {
  const { supabase, user, profile } = await requireManagerPage();
  const snapshot = await getManagerFleetSnapshot(
    supabase,
    user.id,
    profile.billing_cycle_start_day ?? 1
  );

  return (
    <ManagerAiClient
      snapshot={{ devices: snapshot.devices, totals: snapshot.totals }}
    />
  );
}
