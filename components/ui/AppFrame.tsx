"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import AppSidebar from "@/components/ui/AppSidebar";
import AuthBrandPanel from "@/components/ui/AuthBrandPanel";
import { APP_DESKTOP_SECTIONS, APP_SHELL_PREFIXES, matchesPath } from "@/components/ui/app-nav";

const AUTH_SPLIT_PREFIXES = ["/login", "/register", "/forgot-password"];

/** Phones get the 430px app column; laptops and desktops (lg+) get room to breathe. */
const PHONE_COLUMN = "mx-auto min-h-dvh w-full max-w-[430px] overflow-x-hidden sm:min-h-screen";

/** The desktop content panel; ManagerShell uses it too. */
export const DESKTOP_PANEL =
  "lg:min-h-[calc(100dvh-1rem)] lg:rounded-2xl lg:border lg:border-fg/[0.06] lg:bg-canvas";

/**
 * The page frame for every route, chosen by path. It lives in the root layout,
 * so the desktop sidebar stays mounted (and in place) while route loading
 * screens show.
 */
export default function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isUnder = (prefixes: string[]) => prefixes.some((prefix) => matchesPath(pathname, prefix));

  // These lay themselves out: admin has its own sidebar, the manager shell its own nav,
  // and the landing page runs full width.
  if (isUnder(["/admin", "/pitch-deck", "/manager", "/onboarding"])) {
    return <>{children}</>;
  }

  if (isUnder(APP_SHELL_PREFIXES)) {
    return (
      // Desktop: pages sit on a rounded panel beside the sidebar rail.
      // --app-sidebar lets fixed elements (toasts) centre on the panel.
      <div className="lg:min-h-dvh lg:bg-sidebar lg:py-2 lg:pl-56 lg:pr-2 lg:[--app-sidebar:14rem] xl:pl-64 xl:[--app-sidebar:16rem]">
        <AppSidebar sections={APP_DESKTOP_SECTIONS} homeHref="/dashboard" settingsHref="/settings" />
        <div className={DESKTOP_PANEL}>
          <div className={`${PHONE_COLUMN} md:max-w-2xl lg:min-h-0 lg:max-w-6xl lg:px-6 2xl:max-w-7xl`}>{children}</div>
        </div>
      </div>
    );
  }

  if (isUnder(AUTH_SPLIT_PREFIXES)) {
    return (
      <div className="lg:grid lg:min-h-dvh lg:grid-cols-2">
        <AuthBrandPanel />
        <div className={`${PHONE_COLUMN} lg:flex lg:flex-col lg:justify-center lg:py-10`}>{children}</div>
      </div>
    );
  }

  return <div className={PHONE_COLUMN}>{children}</div>;
}
