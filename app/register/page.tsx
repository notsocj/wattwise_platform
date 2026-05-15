"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/ui/ThemeToggle";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // Profile row is auto-created by Supabase trigger (handle_new_user)
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-base tracking-tight">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      {/* Top Section — Logo & Branding */}
      <div className="flex flex-col items-center pt-16 pb-6 px-6">
        {/* Mascot */}
        <div className="flex h-24 w-24 items-center justify-center">
          <Image
            src="/wattwise_mascot.png"
            alt="WattWise mascot"
            width={72}
            height={72}
            className="h-20 w-20 object-contain"
          />
        </div>

        {/* Brand Name */}
        <h1 className="text-3xl font-bold text-white">
          Watt<span className="text-mint">Wise</span>
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

        {/* Error Message */}
        {error && (
          <div className="mb-5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister}>
        {/* Home Name */}
        <div className="mb-5">
          <label className="block text-white text-base font-semibold mb-2">
            Home Name
          </label>
          <input
            type="text"
            placeholder="e.g., Santos Residence"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-mint text-black text-[17px] font-bold py-4 rounded-xl transition-transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Creating Account..." : "Sign Up"}
        </button>
        </form>

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
