"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getFriendlyAuthError } from "@/lib/user-form-messages";
import { logoutOneSignal } from "@/lib/onesignal";
import FormAlert from "@/components/ui/FormAlert";
import LoadingIndicator from "@/components/ui/LoadingIndicator";
import SubmitButton, { type SubmitStatus } from "@/components/ui/SubmitButton";

type UpdatePasswordFormProps = {
  mode?: "update" | "reset";
  backHref?: string;
};

type SessionState = "checking" | "ready" | "missing";

export default function UpdatePasswordForm({
  mode = "update",
  backHref = "/dashboard",
}: UpdatePasswordFormProps) {
  const router = useRouter();
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function prepareSession() {
      const code = new URLSearchParams(window.location.search).get("code");

      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError && isMounted) {
          setError(getFriendlyAuthError(exchangeError.message, "update"));
        }

        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (isMounted) {
        setSessionState(session ? "ready" : "missing");
      }
    }

    prepareSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setSessionState("ready");
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setStatus("loading");

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(getFriendlyAuthError(updateError.message, "update"));
        return;
      }

      if (mode === "update") {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { error: flagError } = await supabase
            .from("profiles")
            .update({ must_update_password: false })
            .eq("id", user.id);

          // Without clearing the flag the user would loop back to this page.
          if (flagError) {
            setError("Your password changed, but we couldn't finish setup. Tap Update Password again.");
            return;
          }
        }
      }

      // Let the button confirm the change before the success screen replaces the form.
      setStatus("success");
      await new Promise((resolve) => setTimeout(resolve, 700));
      setPassword("");
      setConfirmPassword("");
      setSuccess(true);

      if (mode === "reset") {
        await logoutOneSignal().catch(() => undefined);
        await supabase.auth.signOut();
        setTimeout(() => {
          router.replace("/login");
        }, 1800);
        return;
      }

      router.refresh();
    } catch (err) {
      setError(getFriendlyAuthError(err instanceof Error ? err.message : undefined, "update"));
    } finally {
      setStatus("idle");
    }
  }

  if (sessionState === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-6 text-fg">
        <div className="rounded-xl border border-fg/10 bg-fg/[0.03] px-5 py-4">
          <LoadingIndicator size="md" label="Preparing secure session" />
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-fg">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-bida/10">
          <CheckCircle2 className="h-8 w-8 text-bida" />
        </div>
        <h1 className="mb-2 text-2xl font-bold">Password Updated</h1>
        <p className="mb-8 max-w-sm text-center text-sm leading-6 text-fg/50">
          {mode === "reset"
            ? "Your password has been updated successfully. Redirecting to login..."
            : "Your WattWise account password has been changed successfully."}
        </p>
        {mode === "reset" ? (
          <LoadingIndicator size="sm" label="Redirecting" />
        ) : (
          <Link
            href={backHref}
            className="inline-flex w-full max-w-sm items-center justify-center rounded-full bg-mint px-4 py-4 text-[17px] font-bold text-ink transition-transform active:scale-95"
          >
            Continue
          </Link>
        )}
      </div>
    );
  }

  if (sessionState === "missing") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-fg">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-danger/10">
          <KeyRound className="h-8 w-8 text-danger" />
        </div>
        <h1 className="mb-2 text-2xl font-bold">Reset Link Required</h1>
        <p className="mb-8 max-w-sm text-center text-sm leading-6 text-fg/50">
          Open this page from your password reset email, or sign in first to update
          your password from your account.
        </p>
        <div className="flex w-full max-w-sm flex-col gap-3">
          <Link
            href="/forgot-password"
            className="inline-flex items-center justify-center rounded-full bg-mint px-4 py-4 text-[17px] font-bold text-ink transition-transform active:scale-95"
          >
            Request Reset Link
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-fg/10 px-4 py-4 text-sm font-semibold text-accent transition-colors hover:border-mint/40"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas tracking-tight text-fg">
      <div className="flex flex-col items-center px-6 pb-6 pt-14">
        <div className="mb-3 flex h-20 w-20 items-center justify-center">
          <Image
            src="/wattwise_mascot.png"
            alt="WattWise mascot"
            width={72}
            height={72}
            className="h-16 w-16 object-contain"
          />
        </div>
        <h1 className="text-3xl font-bold">
          Watt<span className="text-accent">Wise</span>
        </h1>
        <p className="text-[10px] font-semibold tracking-[0.4em] text-accent/70">
          {mode === "reset" ? "RESET PASSWORD" : "UPDATE PASSWORD"}
        </p>
      </div>

      <div className="flex flex-1 flex-col px-6 pt-4">
        <FormAlert message={error} />

        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="mb-2 block text-base font-semibold text-fg">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-full border border-mint/40 bg-transparent px-4 py-4 pr-12 text-base text-fg placeholder-fg/30 transition-colors focus:border-mint focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-accent/60 transition-colors hover:text-accent"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
            <p className="mt-2 text-sm text-fg/40">
              Use at least 8 characters.
            </p>
          </div>

          <div className="mb-8">
            <label className="mb-2 block text-base font-semibold text-fg">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-full border border-mint/40 bg-transparent px-4 py-4 pr-12 text-base text-fg placeholder-fg/30 transition-colors focus:border-mint focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                aria-label={
                  showConfirmPassword ? "Hide confirmation" : "Show confirmation"
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 text-accent/60 transition-colors hover:text-accent"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <SubmitButton
            status={status}
            disabled={!password || !confirmPassword}
            idleLabel="Update Password"
            loadingLabel="Updating..."
            successLabel="Password updated!"
          />
        </form>

        <div className="mt-6 flex justify-center">
          {mode === "reset" ? (
            // The recovery link signs the user in; leaving without a new
            // password must end that session instead of entering the app.
            <button
              type="button"
              onClick={async () => {
                await createClient().auth.signOut();
                router.replace("/login");
              }}
              className="flex items-center gap-2 text-sm font-semibold text-accent transition-colors hover:text-accent/80"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </button>
          ) : (
            <Link
              href={backHref}
              className="flex items-center gap-2 text-sm font-semibold text-accent transition-colors hover:text-accent/80"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
