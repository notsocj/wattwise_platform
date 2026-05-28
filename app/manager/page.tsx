import ManagerFleetDashboard from "@/components/manager/ManagerFleetDashboard";
import RealtimeRefreshBridge from "@/components/realtime/RealtimeRefreshBridge";
import { getManagerFleetSnapshot, requireManagerPage } from "@/lib/manager-data";

export default async function ManagerPage() {
  const { supabase, user, profile } = await requireManagerPage();
  const snapshot = await getManagerFleetSnapshot(
    supabase,
    user.id,
    profile.billing_cycle_start_day ?? 1
  );
  const realtimeDeviceKeys = Array.from(
    new Set(snapshot.devices.flatMap((device) => [device.id, device.mac_address]))
  );

  return (
    <>
      <RealtimeRefreshBridge deviceKeys={realtimeDeviceKeys} />
      <ManagerFleetDashboard snapshot={snapshot} />
    </>
  );
}
