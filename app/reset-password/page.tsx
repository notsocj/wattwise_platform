"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Eye, EyeOff, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import LoadingIndicator from "@/components/ui/LoadingIndicator";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isRecoverySessionValid, setIsRecoverySessionValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) {
        return;
      }

      if (event === "PASSWORD_RECOVERY" || session?.user) {
        setIsRecoverySessionValid(true);
        setCheckingSession(false);
        setError(null);
      }
    });

    async function validateRecoverySession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      const valid = Boolean(session?.user);
      setIsRecoverySessionValid(valid);
      setCheckingSession(false);

      if (!valid) {
        setError("This reset link is invalid or has expired. Request a new one.");
      }
    }

    validateRecoverySession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    if (loading) {
      return;
    }

    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      await supabase.auth.signOut();
      setSuccess(true);

      setTimeout(() => {
        router.replace("/login");
      }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password right now.");
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-base text-white flex items-center justify-center px-6">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4">
          <LoadingIndicator size="md" label="Validating reset link" />
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-base text-white flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 rounded-full bg-bida/10 flex items-center justify-center mb-6">
          <KeyRound className="w-8 h-8 text-bida" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Password Updated</h1>
        <p className="text-white/50 text-center mb-6 max-w-sm">
          Your password has been updated successfully. Redirecting to login...
        </p>
        <LoadingIndicator size="sm" label="Redirecting" />
      </div>
    );
  }

  if (!isRecoverySessionValid) {
    return (
      <div className="min-h-screen bg-base text-white flex flex-col items-center justify-center px-6">
        <div className="mb-5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger max-w-sm text-center">
          {error}
        </div>
        <Link
          href="/forgot-password"
          className="text-mint text-sm font-semibold hover:text-mint/80 transition-colors"
        >
          Request another reset link
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-base tracking-tight">
      <div className="flex flex-col items-center pt-16 pb-6 px-6">
        <div className="mb-3 flex h-24 w-24 items-center justify-center">
          <Image
            src="/wattwise_mascot.png"
            alt="WattWise mascot"
            width={72}
            height={72}
            className="h-16 w-16 object-contain"
          />
        </div>

        <h1 className="text-3xl font-bold text-white mb-0">
          Watt<span className="text-mint">Wise</span>
        </h1>

        <p className="text-[10px] font-semibold tracking-[0.4em] text-mint/70">SET NEW PASSWORD</p>
      </div>

      <div className="flex flex-col flex-1 px-6 pt-6">
        {error ? (
          <div className="mb-5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        <form onSubmit={handlePasswordReset}>
          <div className="mb-5">
            <label className="block text-white text-base font-semibold mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border border-mint/40 rounded-xl px-4 py-4 text-white placeholder-white/30 text-base focus:outline-none focus:border-mint transition-colors pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-mint/60 hover:text-mint transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="mb-2">
            <label className="block text-white text-base font-semibold mb-2">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-transparent border border-mint/40 rounded-xl px-4 py-4 text-white placeholder-white/30 text-base focus:outline-none focus:border-mint transition-colors pr-12"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-mint/60 hover:text-mint transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <p className="text-white/40 text-xs mb-8">Must be at least 8 characters long.</p>

          <button
            type="submit"
            disabled={loading || !password || !confirmPassword}
            className="inline-flex w-full items-center justify-center bg-mint text-black text-[17px] font-bold py-4 rounded-xl transition-transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <LoadingIndicator
                  size="sm"
                  label="Updating password"
                  showLabel={false}
                  spinnerClassName="border-black/30 border-t-black"
                />
                Updating...
              </span>
            ) : (
              "Update Password"
            )}
          </button>
        </form>

        <div className="flex justify-center mt-6">
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
