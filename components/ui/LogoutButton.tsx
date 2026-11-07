"use client";

import { LogOut } from "@/components/ui/icons";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { logoutOneSignal } from "@/lib/onesignal";

/**
 * Signs out and returns to /login. `scope: "global"` ends every session of
 * this account (all phones and browsers); "local" (default) only this one.
 */
export function useLogout() {
  const router = useRouter();
  const [pending, setPending] = useState<"local" | "global" | null>(null);

  async function logout(scope: "local" | "global" = "local") {
    if (pending) return;
    setPending(scope);
    const supabase = createClient();
    await logoutOneSignal().catch(() => undefined);
    const { error } = await supabase.auth.signOut({ scope });
    if (error && scope === "global") {
      // Fall back to this device so the user is never left half signed in.
      await supabase.auth.signOut({ scope: "local" });
    }
    router.replace("/login");
    router.refresh();
  }

  return { logout, pending };
}

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
  const { logout, pending } = useLogout();
  const isLoading = pending !== null;

  return (
    <button
      type="button"
      onClick={() => void logout()}
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
