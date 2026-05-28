export type UserRole = "user" | "manager" | "tenant" | "super_admin";

export function getHomePathForRole(role: string | null | undefined): string {
  if (role === "super_admin") {
    return "/admin";
  }

  if (role === "manager") {
    return "/manager";
  }

  return "/dashboard";
}

export function isTenantRole(role: string | null | undefined): boolean {
  return role === "tenant";
}

export function canManageDevices(role: string | null | undefined): boolean {
  return role === "user" || role === "manager" || role === "super_admin";
}
