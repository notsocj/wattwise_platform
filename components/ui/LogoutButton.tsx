"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LogoutButtonProps } from "@/components/ui/LogoutButton.types";

export default function LogoutButton({
  className,
  label = "Logout",
}: LogoutButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      aria-label={isLoading ? "Signing out" : label}
      className={
        className ??
        "inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] p-2 text-white/70 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only">{isLoading ? "Signing out..." : label}</span>
    </button>
  );
}
