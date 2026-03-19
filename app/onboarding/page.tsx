"use client";

import { Zap } from "lucide-react";
import Link from "next/link";

export default function OnboardingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-base tracking-tight animate-in fade-in duration-700">
      {/* Top Header Logo */}
      <div className="flex items-center justify-center pt-16 pb-4">
        <Zap className="h-5 w-5 text-mint fill-mint mr-1.5" />
        <h2 className="text-xl font-bold text-white flex items-center">
          Watt<span className="text-mint text-mint-glow">Wise</span>
        </h2>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center flex-1 px-6">
        {/* Core Circular Logo element */}
        <div className="relative mb-10 flex h-36 w-36 items-center justify-center rounded-full border border-mint/20 bg-mint/5 shadow-mint-glow">
          <Zap className="h-14 w-14 text-mint fill-mint" />
        </div>

        {/* Value Proposition */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-1 tracking-tight">
            Smart Energy.
          </h1>
          <h1 className="text-4xl font-bold text-mint mb-6 tracking-tight text-mint-glow">
            Real Savings.
          </h1>
          <p className="text-white/60 text-[17px] leading-relaxed max-w-[320px] mx-auto">
            Take control of your household energy with industrial-grade precision.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="w-full max-w-sm flex flex-col gap-4 mt-2">
          <Link href="/login" className="w-full">
            <button className="w-full bg-mint text-black text-[17px] font-bold py-4 rounded-xl transition-transform active:scale-95">
              Login
            </button>
          </Link>
          <Link href="/register" className="w-full">
            <button className="w-full bg-transparent border border-mint text-mint text-[17px] font-bold py-4 rounded-xl transition-colors hover:bg-mint/5 active:scale-95">
              Register
            </button>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="pb-10 pt-4 text-center">
        <p className="text-sm text-white/40">Optimized for sustainable living.</p>
      </div>
    </div>
  );
}