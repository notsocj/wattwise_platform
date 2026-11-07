import type { ComponentType } from "react";
import {
  Building2,
  CalendarDays,
  DoorOpen,
  FileText,
  Home,
  LineChart,
  ReceiptText,
  Settings,
  Users,
} from "@/components/ui/icons";
import BrandMark from "@/components/ui/BrandMark";

export type NavItem = {
  href: string;
  label: string;
  /** A Lucide icon, or BrandMark for the WattWise assistant. */
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
};

/** The four tabs on the phone bottom bar; the desktop sidebar shows them too. */
export const APP_TABS: readonly NavItem[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/analytics", label: "Burn", icon: LineChart },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export type NavSection = {
  label: string;
  items: readonly NavItem[];
};

/**
 * Desktop sidebar groups. Settings is left out: the sidebar lists it beside
 * the account card at the bottom. Calendar and Meralco Rates, which phones
 * reach from cards, get their own entries here.
 */
export const APP_DESKTOP_SECTIONS: readonly NavSection[] = [
  { label: "Overview", items: APP_TABS.filter(({ href }) => href !== "/settings") },
  {
    label: "Billing",
    items: [
      { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/rates", label: "Meralco Rates", icon: ReceiptText },
    ],
  },
];

export const MANAGER_TABS: readonly NavItem[] = [
  { href: "/manager", label: "Fleet", icon: Building2 },
  { href: "/manager/rooms", label: "Rooms", icon: DoorOpen },
  { href: "/manager/tenants", label: "Tenants", icon: Users },
  { href: "/manager/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/manager/ai", label: "AI", icon: BrandMark },
  { href: "/manager/settings", label: "Settings", icon: Settings },
];

export const MANAGER_DESKTOP_SECTIONS: readonly NavSection[] = [
  { label: "Property", items: MANAGER_TABS.filter(({ href }) => href !== "/manager/settings") },
];

/** Routes that get the desktop sidebar from `AppFrame`. */
export const APP_SHELL_PREFIXES = ["/dashboard", "/analytics", "/reports", "/settings", "/rates"];

export function matchesPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The item whose href is the longest match wins, so /dashboard/calendar
 * highlights Calendar rather than Home when both are listed.
 */
export function getActiveHref(pathname: string, items: readonly NavItem[]) {
  let active: string | null = null;
  for (const { href } of items) {
    if (matchesPath(pathname, href) && href.length > (active?.length ?? 0)) {
      active = href;
    }
  }
  return active;
}
