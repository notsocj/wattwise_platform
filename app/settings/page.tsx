import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import BottomNav from "@/components/ui/BottomNav";
import LogoutButton from "@/components/ui/LogoutButton";
import SettingsClient from "@/components/settings/SettingsClient";
import { createClient } from "@/lib/supabase/server";

type SettingsDevice = {
  id: string;
  device_name: string;
  require_approval_on_expiry: boolean | null;
  user_approved_limit_php: number | string | null;
  budget_status: string | null;
};

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: devices } = await supabase
    .from("devices")
    .select("id, device_name, require_approval_on_expiry, user_approved_limit_php, budget_status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return (
    <div className="min-h-screen bg-base pb-24 text-white">
      <header className="fixed top-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-b border-white/5 bg-base/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-5 pb-4 pt-5">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-mint" />
            <h1 className="text-lg font-bold tracking-tight">Settings</h1>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="flex flex-col gap-4 px-5 pt-[84px]">
        <SettingsClient
          email={user.email ?? "Your WattWise account"}
          devices={(devices ?? []) as SettingsDevice[]}
        />
      </main>

      <BottomNav />
    </div>
  );
}
