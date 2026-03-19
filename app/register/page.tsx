"use client";

import { useState } from "react";
import { Zap, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-base tracking-tight">
      {/* Top Section — Logo & Branding */}
      <div className="flex flex-col items-center pt-16 pb-6 px-6">
        {/* Glow Circle */}
        <div className="relative mb-5 flex h-24 w-24 items-center justify-center rounded-full border border-mint/20 bg-mint/10 shadow-mint-glow">
          <Zap className="h-10 w-10 text-mint fill-mint" />
        </div>

        {/* Brand Name */}
        <h1 className="text-3xl font-bold text-white mb-1">
          Watt<span className="text-mint text-mint-glow">Wise</span>
        </h1>

        {/* Subtitle */}
        <p className="text-[10px] font-semibold tracking-[0.4em] text-mint/70">
          INTELLIGENT ENERGY
        </p>
      </div>

      {/* Form Section */}
      <div className="flex flex-col flex-1 px-6 pt-2">
        {/* Create Account Heading */}
        <h2 className="text-xl font-bold text-white mb-6">Create Account</h2>

        {/* Home Name */}
        <div className="mb-5">
          <label className="block text-white text-base font-semibold mb-2">
            Home Name
          </label>
          <input
            type="text"
            placeholder="e.g., Santos Residence"
            className="w-full bg-transparent border border-mint/40 rounded-xl px-4 py-4 text-white placeholder-white/30 text-base focus:outline-none focus:border-mint transition-colors"
          />
        </div>

        {/* Email Address */}
        <div className="mb-5">
          <label className="block text-white text-base font-semibold mb-2">
            Email Address
          </label>
          <input
            type="email"
            placeholder="your@email.com"
            className="w-full bg-transparent border border-mint/40 rounded-xl px-4 py-4 text-white placeholder-white/30 text-base focus:outline-none focus:border-mint transition-colors"
          />
        </div>

        {/* Password */}
        <div className="mb-2">
          <label className="block text-white text-base font-semibold mb-2">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              className="w-full bg-transparent border border-mint/40 rounded-xl px-4 py-4 text-white placeholder-white/30 text-base focus:outline-none focus:border-mint transition-colors pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-mint/60 hover:text-mint transition-colors"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Password Hint */}
        <p className="text-white/40 text-xs mb-8">Must be at least 8 characters long.</p>

        {/* Sign Up Button */}
        <button className="w-full bg-mint text-black text-[17px] font-bold py-4 rounded-xl transition-transform active:scale-95">
          Sign Up
        </button>

        {/* Login Link */}
        <div className="flex justify-center mt-6">
          <p className="text-white/50 text-sm">
            Already have an account?{" "}
            <Link href="/login" className="text-mint font-bold hover:text-mint/80 transition-colors">
              Log In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
