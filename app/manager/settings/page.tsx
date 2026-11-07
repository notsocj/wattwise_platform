import { AlertTriangle, CheckCircle2 } from "@/components/ui/icons";
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
    <div className="space-y-6">
      <section
        className={`rounded-xl border p-5 ${
          adminConfigured
            ? "border-mint/30 bg-mint/10"
            : "border-naku/30 bg-naku/10"
        }`}
      >
        <div className="flex items-start gap-3">
          {adminConfigured ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-naku" />
          )}
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Tenant Creation Config
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-fg/60">
              {adminConfigured
                ? "You can create tenant accounts from the Tenants tab."
                : "Tenant account creation isn't available yet. Contact WattWise support to enable it."}
            </p>
          </div>
        </div>
      </section>

      <SettingsClient
        fullName={profile.full_name ?? null}
        billingCycleStartDay={profile.billing_cycle_start_day ?? 1}
        meralcoMonthlyKwh={profile.meralco_monthly_kwh == null ? null : Number(profile.meralco_monthly_kwh)}
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
