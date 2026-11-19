"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import FormAlert from "@/components/ui/FormAlert";
import LoadingIndicator from "@/components/ui/LoadingIndicator";
import SubmitButton, { type SubmitStatus } from "@/components/ui/SubmitButton";
import { useLogout } from "@/components/ui/LogoutButton";
import { createClient } from "@/lib/supabase/client";

type Step =
  | { kind: "loading" }
  | { kind: "verify"; factorId: string }
  | { kind: "enroll"; factorId: string; qrCode: string; secret: string }
  | { kind: "error"; message: string };

const CODE_PATTERN = /^\d{6}$/;

/**
 * Second sign-in step for the admin console (the middleware sends super admins
 * here until their session is aal2). First visit: scan a QR code into an
 * authenticator app. Every sign-in after that: enter its 6-digit code.
 */
export default function TwoFactorPage() {
  const router = useRouter();
  const { logout, pending: loggingOut } = useLogout();
  const [step, setStep] = useState<Step>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (listError || !data) {
        setStep({ kind: "error", message: "We couldn't load your two-factor settings. Refresh the page to try again." });
        return;
      }

      const verified = data.totp.find((factor) => factor.status === "verified");
      if (verified) {
        setStep({ kind: "verify", factorId: verified.id });
        return;
      }

      // A setup that was started but never finished can't be reused; start a fresh one.
      for (const factor of data.all.filter((f) => f.factor_type === "totp" && f.status !== "verified")) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "WattWise admin",
      });
      if (cancelled) return;
      if (enrollError || !enrolled) {
        setStep({ kind: "error", message: "We couldn't start two-factor setup. Refresh the page to try again." });
        return;
      }
      setStep({ kind: "enroll", factorId: enrolled.id, qrCode: enrolled.totp.qr_code, secret: enrolled.totp.secret });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (step.kind !== "verify" && step.kind !== "enroll") return;
    const trimmed = code.replace(/\s/g, "");
    if (!CODE_PATTERN.test(trimmed)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setError(null);
    setStatus("loading");
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: step.factorId, code: trimmed });
    if (verifyError) {
      setStatus("idle");
      setCode("");
      setError(
        verifyError.message.toLowerCase().includes("invalid")
          ? "That code didn't match. Codes change every 30 seconds, so enter the one showing now."
          : "We couldn't verify the code. Try again.",
      );
      return;
    }

    setStatus("success");
    router.replace("/admin");
    router.refresh();
  }

  const enrolling = step.kind === "enroll";

  return (
    <div className="relative flex min-h-screen flex-col bg-canvas tracking-tight lg:min-h-0">
      <div className="flex flex-col items-center px-6 pb-6 pt-16 lg:hidden">
        <div className="mb-3 flex h-24 w-24 items-center justify-center">
          <Image src="/wattwise_mascot.png" alt="WattWise mascot" width={72} height={72} className="h-16 w-16 object-contain" />
        </div>
        <h1 className="mb-0 text-3xl font-bold text-fg">
          Watt<span className="text-accent">Wise</span>
        </h1>
        <p className="text-[10px] font-semibold tracking-[0.4em] text-accent/70">ADMIN VERIFICATION</p>
      </div>

      <div className="flex flex-1 flex-col px-6 pt-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-fg lg:text-3xl">
            {enrolling ? "Set up two-factor sign-in" : "Enter your verification code"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-fg/55">
            {enrolling
              ? "The admin console needs a second step. Scan this QR code with Google Authenticator, Microsoft Authenticator or Authy, then enter the 6-digit code it shows."
              : "Open your authenticator app and enter the 6-digit code for WattWise."}
          </p>
        </div>

        {step.kind === "loading" ? (
          <div className="flex justify-center py-10">
            <LoadingIndicator label="Loading two-factor settings" />
          </div>
        ) : step.kind === "error" ? (
          <FormAlert message={step.message} />
        ) : (
          <>
            {step.kind === "enroll" ? (
              <div className="mb-6 flex flex-col items-center gap-3 rounded-2xl border border-fg/[0.06] bg-fg/[0.03] p-5">
                {/* The QR code is always dark on white so every phone camera reads it. */}
                <div className="rounded-xl bg-white p-3">
                  <Image src={step.qrCode} alt="QR code for your authenticator app" width={176} height={176} unoptimized />
                </div>
                <p className="text-center text-xs text-fg/50">
                  Can&apos;t scan it? Enter this key in the app instead:
                  <span className="mt-1 block break-all font-mono text-sm font-semibold tracking-wider text-fg/80">
                    {step.secret}
                  </span>
                </p>
              </div>
            ) : null}

            <FormAlert message={error} />

            <form onSubmit={handleSubmit} noValidate>
              <label htmlFor="two-factor-code" className="mb-2 block text-base font-semibold text-fg">
                6-digit code
              </label>
              <input
                id="two-factor-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={7}
                placeholder="123456"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/[^\d\s]/g, ""));
                  setError(null);
                }}
                className="mb-6 w-full rounded-full border border-mint/40 bg-transparent px-5 py-4 text-center font-mono text-2xl tracking-[0.4em] text-fg placeholder-fg/20 transition-colors focus:border-mint focus:outline-none"
              />
              <SubmitButton
                status={status}
                idleLabel={enrolling ? "Turn on and continue" : "Verify"}
                loadingLabel="Verifying..."
                successLabel="Verified"
                disabled={code.replace(/\s/g, "").length !== 6}
              />
            </form>
          </>
        )}

        <button
          type="button"
          onClick={() => void logout()}
          disabled={loggingOut !== null}
          className="mx-auto mt-6 h-10 rounded-full px-4 text-sm font-semibold text-fg/60 transition-colors hover:text-fg disabled:opacity-60"
        >
          {loggingOut ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </div>
  );
}
