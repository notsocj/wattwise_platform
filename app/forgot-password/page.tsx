"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { KeyRound, ArrowLeft } from "lucide-react";
import FormAlert from "@/components/ui/FormAlert";
import SubmitButton, { type SubmitStatus } from "@/components/ui/SubmitButton";
import { createClient } from "@/lib/supabase/client";
import {
  getFriendlyAuthError,
  normalizeEmail,
  validateEmailAddress,
} from "@/lib/user-form-messages";

type ResetFieldErrors = Partial<{
  email: string;
}>;

const inputBaseClass =
  "w-full bg-transparent rounded-xl px-4 py-4 text-fg placeholder-fg/30 text-base focus:outline-none transition-colors";

function getInputClass(hasError: boolean): string {
  const stateClass = hasError
    ? "border border-danger/70 focus:border-danger"
    : "border border-mint/40 focus:border-mint";

  return `${inputBaseClass} ${stateClass}`;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ResetFieldErrors>({});
  const [success, setSuccess] = useState(false);

  function validateForm(): ResetFieldErrors {
    const emailError = validateEmailAddress(
      email,
      "Enter the email address linked to your WattWise account."
    );

    return emailError ? { email: emailError } : {};
  }

  function clearEmailError() {
    setSubmitError(null);
    setFieldErrors({});
  }

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const nextErrors = validateForm();
    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setSubmitError("Please fix the highlighted email field before continuing.");
      return;
    }

    setStatus("loading");

    try {
      const normalizedEmail = normalizeEmail(email);
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (resetError) {
        setSubmitError(getFriendlyAuthError(resetError.message, "reset"));
      } else {
        setEmail(normalizedEmail);
        // Let the button confirm the send before the "check your email" screen replaces the form.
        setStatus("success");
        await new Promise((resolve) => setTimeout(resolve, 700));
        setSuccess(true);
        return;
      }
    } catch (err) {
      setSubmitError(
        getFriendlyAuthError(err instanceof Error ? err.message : undefined, "reset")
      );
    }
    setStatus("idle");
  }

  if (success) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-fg">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-bida/10">
          <KeyRound className="h-8 w-8 text-bida" />
        </div>
        <h1 className="mb-2 text-2xl font-bold">Check Your Email</h1>
        <p className="mb-8 max-w-sm text-center text-fg/50">
          We&apos;ve sent a password reset link to{" "}
          <span className="font-semibold text-accent">{email}</span>. Click the
          link to set a new password.
        </p>
        <p className="mb-8 max-w-sm text-center text-sm text-fg/40">
          The link only works for a limited time. If you don&apos;t receive it,
          check your spam folder.
        </p>
        <Link
          href="/login"
          className="flex items-center gap-2 text-sm font-semibold text-accent transition-colors hover:text-accent/80"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-canvas tracking-tight lg:min-h-0">
      {/* Desktop shows the brand panel beside the form instead. */}
      <div className="flex flex-col items-center px-6 pb-6 pt-16 lg:hidden">
        <div className="mb-3 flex h-24 w-24 items-center justify-center">
          <Image
            src="/wattwise_mascot.png"
            alt="WattWise mascot"
            width={72}
            height={72}
            className="h-16 w-16 object-contain"
          />
        </div>

        <h1 className="mb-0 text-3xl font-bold text-fg">
          Watt<span className="text-accent">Wise</span>
        </h1>

        <p className="text-[10px] font-semibold tracking-[0.4em] text-accent/70">
          RESET YOUR PASSWORD
        </p>
      </div>

      <div className="flex flex-1 flex-col px-6 pt-6">
        <div className="mb-8 hidden lg:block">
          <h1 className="text-3xl font-bold tracking-tight text-fg">Reset your password</h1>
          <p className="mt-2 text-sm text-fg/50">We&apos;ll email you a link to set a new one.</p>
        </div>

        <FormAlert message={submitError} />

        <form onSubmit={handleResetRequest} noValidate>
          <div className="mb-6">
            <label
              htmlFor="reset-email"
              className="mb-2 block text-base font-semibold text-fg"
            >
              Email Address
            </label>
            <input
              id="reset-email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearEmailError();
              }}
              onBlur={() =>
                setFieldErrors({
                  email:
                    validateEmailAddress(
                      email,
                      "Enter the email address linked to your WattWise account."
                    ) ?? undefined,
                })
              }
              autoComplete="email"
              required
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby="reset-email-message"
              className={getInputClass(Boolean(fieldErrors.email))}
            />
            <p
              id="reset-email-message"
              className={`mt-2 text-sm ${
                fieldErrors.email ? "text-danger" : "text-fg/40"
              }`}
            >
              {fieldErrors.email ??
                "We will send you a link to reset your password."}
            </p>
          </div>

          <SubmitButton
            status={status}
            idleLabel="Send Reset Link"
            loadingLabel="Sending..."
            successLabel="Link sent!"
            className="mb-4"
          />
        </form>

        <div className="flex justify-center">
          <Link
            href="/login"
            className="flex items-center gap-2 text-sm font-semibold text-accent transition-colors hover:text-accent/80"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
