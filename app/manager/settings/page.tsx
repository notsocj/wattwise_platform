import { AlertTriangle, CheckCircle2 } from "lucide-react";
import SettingsClient from "@/components/settings/SettingsClient";
import { hasAdminClientConfig } from "@/lib/supabase/admin";
import { getManagerFleetSnapshot, requireManagerPage } from "@/lib/manager-data";

export default async function ManagerSettingsPage() {
  const { supabase, user, profile } = await requireManagerPage();
  const snapshot = await getManagerFleetSnapshot(
    supabase,
    user.id,
    profile.billing_cycle_start_day ?? 1
  );
  const adminConfigured = hasAdminClientConfig();

  return (
    <div className="space-y-4">
      <section
        className={`rounded-xl border p-5 ${
          adminConfigured
            ? "border-mint/30 bg-mint/10"
            : "border-naku/30 bg-naku/10"
        }`}
      >
        <div className="flex items-start gap-3">
          {adminConfigured ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mint" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-naku" />
          )}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider">
              Tenant Creation Config
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-white/60">
              {adminConfigured
                ? "Supabase service-role configuration is available for manager-created tenant accounts."
                : "Add SUPABASE_SERVICE_ROLE_KEY to your server environment before creating tenants."}
            </p>
          </div>
        </div>
      </section>

      <SettingsClient
        billingCycleStartDay={profile.billing_cycle_start_day ?? 1}
        email={user.email ?? profile.email ?? "Your WattWise account"}
        role="manager"
        devices={snapshot.devices.map((device) => ({
          id: device.id,
          device_name: device.device_name,
          require_approval_on_expiry: device.require_approval_on_expiry,
          user_approved_limit_php: device.user_approved_limit_php,
          budget_status: device.budget_status,
        }))}
        oneSignalAppId={process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? null}
      />
    </div>
  );
}
