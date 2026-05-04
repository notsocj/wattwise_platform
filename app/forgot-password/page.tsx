"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { KeyRound, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        setError(resetError.message);
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-base text-white flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 rounded-full bg-bida/10 flex items-center justify-center mb-6">
          <KeyRound className="w-8 h-8 text-bida" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Check Your Email</h1>
        <p className="text-white/50 text-center mb-8 max-w-sm">
          We&apos;ve sent a password reset link to <span className="text-mint font-semibold">{email}</span>. Click the link to set a new password.
        </p>
        <p className="text-white/40 text-sm text-center mb-8 max-w-sm">
          The link will expire in 24 hours. If you don&apos;t receive it, check your spam folder.
        </p>
        <Link
          href="/login"
          className="text-mint hover:text-mint/80 transition-colors text-sm font-semibold flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-base tracking-tight">
      {/* Top Section — Logo & Branding */}
      <div className="flex flex-col items-center pt-16 pb-6 px-6">
        {/* Mascot */}
        <div className="mb-3 flex h-24 w-24 items-center justify-center">
          <Image
            src="/wattwise_mascot.png"
            alt="WattWise mascot"
            width={72}
            height={72}
            className="h-16 w-16 object-contain"
          />
        </div>

        {/* Brand Name */}
        <h1 className="text-3xl font-bold text-white mb-0">
          Watt<span className="text-mint">Wise</span>
        </h1>

        {/* Subtitle */}
        <p className="text-[10px] font-semibold tracking-[0.4em] text-mint/70">RESET YOUR PASSWORD</p>
      </div>

      {/* Form Section */}
      <div className="flex flex-col flex-1 px-6 pt-6">
        {/* Error Message */}
        {error && (
          <div className="mb-5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleResetRequest}>
        {/* Email Input */}
        <div className="mb-6">
          <label className="block text-white text-base font-semibold mb-2">
            Email Address
          </label>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-transparent border border-mint/40 rounded-xl px-4 py-4 text-white placeholder-white/30 text-base focus:outline-none focus:border-mint transition-colors"
          />
          <p className="text-white/40 text-sm mt-2">
            We&apos;ll send you a link to reset your password.
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !email}
          className="w-full bg-mint text-black text-[17px] font-bold py-4 rounded-xl transition-transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed mb-4"
        >
          {loading ? "Sending..." : "Send Reset Link"}
        </button>
        </form>

        {/* Back to Login Link */}
        <div className="flex justify-center">
          <Link
            href="/login"
            className="text-mint text-sm font-semibold hover:text-mint/80 transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
