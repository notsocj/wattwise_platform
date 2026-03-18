import type { NavigationItem } from "@/types/navigation";

export const navigationItems: NavigationItem[] = [
  {
    label: "Overview",
    href: "/",
    description: "Project scaffold and foundational modules.",
  },
  {
    label: "Dashboard",
    href: "/dashboard",
    description: "Starter metrics route for charts and device summaries.",
  },
  {
    label: "Health API",
    href: "/api/health",
    description: "Simple route for connectivity and environment checks.",
  },
];
