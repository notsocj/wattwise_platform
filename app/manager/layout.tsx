import type { ReactNode } from "react";
import ManagerShell from "@/components/manager/ManagerShell";
import { requireManagerPage } from "@/lib/manager-data";

export default async function ManagerLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireManagerPage();

  return <ManagerShell>{children}</ManagerShell>;
}
