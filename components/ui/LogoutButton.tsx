"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { logoutOneSignal } from "@/lib/onesignal";

type LogoutButtonProps = {
  className?: string;
  label?: string;
  /** Show the label beside the icon (sidebar rows) instead of only to screen readers. */
  showLabel?: boolean;
};

export default function LogoutButton({
  className,
  label = "Logout",
  showLabel = false,
}: LogoutButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    await logoutOneSignal().catch(() => undefined);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      aria-label={showLabel ? undefined : isLoading ? "Signing out" : label}
      className={
        className ??
        "inline-flex h-10 w-10 items-center justify-center rounded-full border border-fg/10 bg-fg/[0.03] text-fg/70 transition-colors hover:border-fg/20 hover:text-fg disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className={showLabel ? undefined : "sr-only"}>{isLoading ? "Signing out..." : label}</span>
    </button>
  );
}
