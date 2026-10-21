import type { ReactNode } from "react";
import ManagerShell from "@/components/manager/ManagerShell";
import { getSessionUser } from "@/lib/auth-context";
import { requireManagerPage } from "@/lib/manager-data";

export default async function ManagerLayout({
  children,
}: {
  children: ReactNode;
}) {
  // The middleware already verified the manager role for this request and
  // forwarded it; only fall back to the database check when it is missing,
  // so the loading screen below this layout can show without a query.
  const user = await getSessionUser();
  if (user?.role !== "manager") {
    await requireManagerPage();
  }

  return <ManagerShell>{children}</ManagerShell>;
}
