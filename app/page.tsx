"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import LoadingIndicator from "@/components/ui/LoadingIndicator";

// The intro plays as CSS keyframes (ww-splash-* in globals.css), so it stays smooth while the app hydrates.
const FADE_OUT_AT = 2900;
const LEAVE_AT = 3200;

export default function SplashScreen() {
  const router = useRouter();
  const { session } = useSupabase();
  const [leaving, setLeaving] = useState(false);
  const destination = session ? "/dashboard" : "/onboarding";

  useEffect(() => {
    router.prefetch(destination);
    const fadeTimer = setTimeout(() => setLeaving(true), FADE_OUT_AT);
    const leaveTimer = setTimeout(() => router.replace(destination), LEAVE_AT);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(leaveTimer);
    };
  }, [router, destination]);

  return (
    <div
      className={`flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 tracking-tight transition-[opacity,scale] duration-300 ease-out ${
        leaving ? "scale-[0.98] opacity-0" : ""
      }`}
    >
      {/* Starts centred on its own, then lifts to make room for the wordmark. */}
      <div className="ww-splash-lift">
        <Image
          src="/wattwise_mascot.png"
          alt="WattWise mascot"
          width={180}
          height={180}
          priority
          className="ww-splash-pop h-36 w-36 object-contain"
        />
      </div>

      <h1 className="ww-splash-rise mt-6 text-5xl font-bold text-fg">
        Watt<span className="text-accent">Wise</span>
      </h1>

      <p className="ww-splash-fade mt-1.5 text-[10px] font-semibold tracking-[0.4em] text-accent/70 sm:text-xs" style={{ animationDelay: "1350ms" }}>
        INTELLIGENT ENERGY
      </p>

      <div className="ww-splash-fade mt-5" style={{ animationDelay: "1650ms" }}>
        <LoadingIndicator size="sm" label="Preparing your energy hub" />
      </div>
    </div>
  );
}
