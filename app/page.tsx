"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import LoadingIndicator from "@/components/ui/LoadingIndicator";

export default function SplashScreen() {
  const router = useRouter();
  const { session } = useSupabase();
  const [animationStep, setAnimationStep] = useState(0);

  useEffect(() => {
    const showMascotTimer = setTimeout(() => {
      setAnimationStep(1);
    }, 120);

    const moveMascotTimer = setTimeout(() => {
      setAnimationStep(2);
    }, 1000);

    const showSubtitleTimer = setTimeout(() => {
      setAnimationStep(3);
    }, 1550);

    return () => {
      clearTimeout(showMascotTimer);
      clearTimeout(moveMascotTimer);
      clearTimeout(showSubtitleTimer);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace(session ? "/dashboard" : "/onboarding");
    }, 3300);
    return () => clearTimeout(timer);
  }, [router, session]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-base tracking-tight transition-opacity duration-500">
      {/* Mascot */}
      <div
        className={`absolute left-1/2 transition-all duration-700 ease-out ${
          animationStep === 0
            ? "top-1/2 -translate-x-1/2 -translate-y-1/2 scale-95 opacity-0"
            : animationStep === 1
              ? "top-1/2 -translate-x-1/2 -translate-y-1/2 scale-100 opacity-100"
              : "top-[46%] -translate-x-1/2 -translate-y-1/2 scale-100 opacity-100"
        }`}
      >
        <Image
          src="/wattwise_mascot.png"
          alt="WattWise mascot"
          width={180}
          height={180}
          priority
          className="h-36 w-36 object-contain"
        />
      </div>

      {/* Brand Name + Subtitle */}
      <div className="absolute inset-x-0 top-[60%] flex -translate-y-1/2 flex-col items-center">
        <h1
          className={`mb-2 flex items-center text-5xl font-bold text-white transition-all duration-500 ${
            animationStep >= 2
              ? "translate-y-0 opacity-100"
              : "translate-y-4 opacity-0"
          }`}
        >
          Watt<span className="text-mint">Wise</span>
        </h1>

        <p
          className={`text-[10px] font-semibold tracking-[0.4em] text-mint/70 transition-opacity duration-700 sm:text-xs ${
            animationStep >= 3 ? "opacity-100" : "opacity-0"
          }`}
        >
          INTELLIGENT ENERGY
        </p>

        <div className="mt-4">
          <LoadingIndicator size="sm" label="Preparing your energy hub" />
        </div>
      </div>
    </div>
  );
}
