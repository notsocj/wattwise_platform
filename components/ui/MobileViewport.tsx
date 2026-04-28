"use client";

import { usePathname } from "next/navigation";
import type { MobileViewportProps } from "@/components/ui/MobileViewport.types";

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