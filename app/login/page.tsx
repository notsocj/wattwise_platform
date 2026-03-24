"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Zap, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("error") === "unauthorized") {
      setError("You do not have permission to access that page.");
    }
  }, [searchParams]);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // Fetch user role for redirect
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    const destination = profile?.role === "super_admin" ? "/admin" : "/dashboard";
    setLoading(false);
    router.push(destination);
    router.refresh();
  }

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
        <p className="text-sm font-semibold text-mint/80">Smart Energy Management</p>
      </div>

      {/* Form Section */}
      <div className="flex flex-col flex-1 px-6 pt-6">
        {/* Error Message */}
        {error && (
          <div className="mb-5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {/* Email */}
        <div className="mb-5">
          <label className="block text-white text-base font-semibold mb-2">
            Email
          </label>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-transparent border border-mint/40 rounded-xl px-4 py-4 text-white placeholder-white/30 text-base focus:outline-none focus:border-mint transition-colors"
          />
        </div>

        {/* Password */}
        <div className="mb-3">
          <label className="block text-white text-base font-semibold mb-2">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
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

        {/* Forgot Password */}
        <div className="flex justify-end mb-8">
          <Link href="/forgot-password" className="text-mint text-sm font-semibold hover:text-mint/80 transition-colors">
            Forgot Password?
          </Link>
        </div>

        {/* Login Button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-mint text-black text-[17px] font-bold py-4 rounded-xl transition-transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        {/* Register Link */}
        <div className="flex justify-center mt-6">
          <p className="text-white/50 text-sm">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-mint font-bold hover:text-mint/80 transition-colors">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
