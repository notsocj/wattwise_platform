import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-context";
import PageHeader from "@/components/ui/PageHeader";
import { Settings } from "@/components/ui/icons";
import BottomNav from "@/components/ui/BottomNav";
import SettingsClient from "@/components/settings/SettingsClient";
import { createClient } from "@/lib/supabase/server";

type SettingsDevice = {
  id: string;
  device_name: string;
  require_approval_on_expiry: boolean | null;
  user_approved_limit_php: number | string | null;
  budget_status: string | null;
};

type ProfileRow = {
  full_name: string | null;
  meralco_monthly_kwh: number | string | null;
  billing_cycle_start_day: number | null;
  role: string | null;
};

export default async function SettingsPage() {
  const supabase = await createClient();

  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: devices }, { data: profile }] = await Promise.all([
    supabase
      .from("devices")
      .select("id, device_name, require_approval_on_expiry, user_approved_limit_php, budget_status")
      .or(`owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .order("created_at", { ascending: true }),
    supabase
      .from("profiles")
      .select("full_name, billing_cycle_start_day, meralco_monthly_kwh, role")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>(),
  ]);

  if (profile?.role === "manager") {
    redirect("/manager/settings");
  }

  return (
    <div className="min-h-screen bg-canvas lg:min-h-0 pb-40 text-fg lg:pb-12">
      <PageHeader icon={Settings} title="Settings" description="Your account, billing, notifications and safety settings." />

      <main className="ww-stagger flex flex-col gap-6 px-5 pt-[84px] lg:max-w-3xl lg:pt-0">
        <SettingsClient
          fullName={profile?.full_name ?? null}
          billingCycleStartDay={profile?.billing_cycle_start_day ?? 1}
          meralcoMonthlyKwh={profile?.meralco_monthly_kwh == null ? null : Number(profile.meralco_monthly_kwh)}
          email={user.email ?? "Your WattWise account"}
          role={profile?.role ?? "user"}
          devices={(devices ?? []) as SettingsDevice[]}
          oneSignalAppId={process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? null}
        />
      </main>

      <BottomNav />
    </div>
  );
}
