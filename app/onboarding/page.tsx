"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import LoadingIndicator from "@/components/ui/LoadingIndicator";

export default function OnboardingPage() {
  const [pendingRoute, setPendingRoute] = useState<"login" | "register" | null>(null);

  function startNavigation(route: "login" | "register") {
    setPendingRoute(route);
  }

  return (
    <div className="flex min-h-screen flex-col bg-base tracking-tight animate-in fade-in duration-700">
      {/* Top Header Logo */}
        <div className="flex items-center justify-center pt-12 pb-3">
          <h2 className="text-xl font-bold text-white flex items-center">
            Watt<span className="text-mint">Wise</span>
          </h2>
        </div>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center flex-1 px-6 pb-4">
        {/* Core Circular Logo element */}
        <div className="mb-5 flex items-center justify-center">
          <Image
            src="/wattwise_mascot.png"
            alt="WattWise mascot"
            width={192}
            height={192}
            className="h-48 w-48 object-contain"
          />
        </div>

        {/* Value Proposition */}
        <div className="text-center mb-5">
          <h1 className="text-4xl font-bold text-white mb-0.5 tracking-tight">
            Smart Energy.
          </h1>
          <h1 className="text-4xl font-bold text-mint mb-3.5 tracking-tight">
            Real Savings.
          </h1>
          <p className="text-white/60 text-[17px] leading-relaxed max-w-[320px] mx-auto">
            Take control of your household energy.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="w-full max-w-sm flex flex-col gap-3.5 mt-1.5">
          <Link
            href="/login"
            onClick={() => startNavigation("login")}
            aria-disabled={pendingRoute !== null}
            className="inline-flex w-full items-center justify-center rounded-xl bg-mint py-4 text-[17px] font-bold text-black transition-transform active:scale-95 aria-disabled:pointer-events-none aria-disabled:opacity-70"
          >
            {pendingRoute === "login" ? (
              <span className="inline-flex items-center gap-2">
                <LoadingIndicator
                  size="sm"
                  label="Opening login"
                  showLabel={false}
                  spinnerClassName="border-black/30 border-t-black"
                />
                Opening login...
              </span>
            ) : (
              "Login"
            )}
          </Link>
          <Link
            href="/register"
            onClick={() => startNavigation("register")}
            aria-disabled={pendingRoute !== null}
            className="inline-flex w-full items-center justify-center rounded-xl border border-mint bg-transparent py-4 text-[17px] font-bold text-mint transition-colors hover:bg-mint/5 active:scale-95 aria-disabled:pointer-events-none aria-disabled:opacity-70"
          >
            {pendingRoute === "register" ? (
              <span className="inline-flex items-center gap-2">
                <LoadingIndicator
                  size="sm"
                  label="Opening register"
                  showLabel={false}
                />
                Opening register...
              </span>
            ) : (
              "Register"
            )}
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="pb-8 pt-3 text-center">
        <p className="text-sm text-white/40">Optimized for sustainable living.</p>
      </div>
    </div>
  );
}