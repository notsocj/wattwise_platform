"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

type MobileViewportProps = {
  children: ReactNode;
};

export default function MobileViewport({ children }: MobileViewportProps) {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] overflow-x-hidden sm:min-h-screen">
      {children}
    </div>
  );
}