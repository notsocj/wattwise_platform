"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/onboarding");
    }, 2500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-base tracking-tight transition-opacity duration-500">
      <div className="flex flex-col items-center justify-center">
        {/* Glow & Icon */}
        <div className="relative mb-8 flex h-32 w-32 items-center justify-center rounded-full border border-mint/20 bg-mint/5 shadow-mint-glow animate-pulse">
          <Zap className="h-12 w-12 text-mint fill-mint" />
        </div>

        {/* Brand Name */}
        <h1 className="text-5xl font-bold text-white mb-2 flex items-center">
          Watt<span className="text-mint text-mint-glow">Wise</span>
        </h1>

        {/* Subtitle */}
        <p className="text-[10px] sm:text-xs font-semibold tracking-[0.4em] text-mint/70">
          INTELLIGENT ENERGY
        </p>
      </div>
    </div>
  );
}
