"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Check, Eye, EyeOff, MailCheck } from "@/components/ui/icons";
import Link from "next/link";
import FormAlert from "@/components/ui/FormAlert";
import SubmitButton, { type SubmitStatus } from "@/components/ui/SubmitButton";
import { getHomePathForRole, type UserRole } from "@/lib/roles";
import { LEGAL_VERSION } from "@/lib/legal";
import { createClient } from "@/lib/supabase/client";
import {
  getFriendlyAuthError,
  normalizeEmail,
  validateEmailAddress,
} from "@/lib/user-form-messages";

type RegisterFieldErrors = Partial<{
  accountType: string;
  fullName: string;
  email: string;
  password: string;
  terms: string;
}>;

type RegisterRole = Extract<UserRole, "user" | "manager">;

const inputBaseClass =
  "w-full bg-transparent rounded-full px-5 py-4 text-fg placeholder-fg/30 text-base focus:outline-none transition-colors";

function getInputClass(hasError: boolean, extraClass = ""): string {
  const stateClass = hasError
    ? "border border-danger/70 focus:border-danger"
    : "border border-mint/40 focus:border-mint";

  return `${inputBaseClass} ${stateClass} ${extraClass}`;
}

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [accountType, setAccountType] = useState<RegisterRole>("user");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

  function validateFullName(value = fullName): string | null {
    return value.trim()
      ? null
      : accountType === "manager"
        ? "Enter your boarding house or property name."
        : "Enter a home name so your dashboard feels personal.";
  }

  function validatePassword(value = password): string | null {
    if (!value) {
      return "Create a password with at least 8 characters.";
    }

    if (value.length < 8) {
      return "Password must be at least 8 characters long.";
    }

    return null;
  }

  function validateForm(): RegisterFieldErrors {
    const nextErrors: RegisterFieldErrors = {};
    const fullNameError = validateFullName();
    const emailError = validateEmailAddress(
      email,
      "Enter the email address you will use to log in."
    );
    const passwordError = validatePassword();

    if (fullNameError) nextErrors.fullName = fullNameError;
    if (emailError) nextErrors.email = emailError;
    if (passwordError) nextErrors.password = passwordError;
    if (!acceptedTerms) nextErrors.terms = "Accept the Terms and Privacy Policy to create an account.";

    return nextErrors;
  }

  function clearFieldError(field: keyof RegisterFieldErrors) {
    setSubmitError(null);
    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }));
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const nextErrors = validateForm();
    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setSubmitError("Please fix the highlighted fields before signing up.");
      return;
    }

    setStatus("loading");
    const supabase = createClient();
    const normalizedEmail = normalizeEmail(email);
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role: accountType,
          // Proof of consent (Data Privacy Act): what was accepted and when.
          terms_version: LEGAL_VERSION,
          terms_accepted_at: new Date().toISOString(),
        },
      },
    });
    if (signUpError) {
      setSubmitError(getFriendlyAuthError(signUpError.message, "register"));
      setStatus("idle");
      return;
    }

    // With email confirmation enabled, Supabase returns no session until the
    // user clicks the link, so pushing into the app would bounce to /login.
    if (!signUpData.session) {
      setConfirmationEmail(normalizedEmail);
      return;
    }

    // Signed in straight away: confirm it while the app loads. The button
    // stays disabled until the next page replaces this one.
    setStatus("success");
    router.push(getHomePathForRole(accountType));
    router.refresh();
  }

  if (confirmationEmail) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-fg">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-bida/10">
          <MailCheck className="h-8 w-8 text-bida" />
        </div>
        <h1 className="mb-2 text-2xl font-bold">Confirm Your Email</h1>
        <p className="mb-8 max-w-sm text-center text-fg/50">
          We sent a confirmation link to{" "}
          <span className="font-semibold text-accent">{confirmationEmail}</span>. Open it
          to activate your account, then log in.
        </p>
        <p className="mb-8 max-w-sm text-center text-sm text-fg/50">
          If it doesn&apos;t arrive in a few minutes, check your spam folder.
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
        <Link href="/onboarding" aria-label="WattWise home page" className="flex flex-col items-center rounded-3xl transition-[scale] duration-150 ease-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint">
          <div className="flex h-24 w-24 items-center justify-center">
            <Image
              src="/wattwise_mascot.png"
              alt="WattWise mascot"
              width={72}
              height={72}
              className="h-20 w-20 object-contain"
            />
          </div>

          <h1 className="text-3xl font-bold text-fg">
            Watt<span className="text-accent">Wise</span>
          </h1>

          <p className="text-[10px] font-semibold tracking-[0.4em] text-accent/70">
            INTELLIGENT ENERGY
          </p>
        </Link>
      </div>

      <div className="flex flex-1 flex-col px-6 pt-2">
        <h2 className="mb-6 text-xl font-bold text-fg">Create Account</h2>

        <FormAlert message={submitError} />

        <form onSubmit={handleRegister} noValidate>
          <div className="mb-5">
            <fieldset>
              <legend className="mb-2 block text-base font-semibold text-fg">
                Account Type
              </legend>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    value: "user" as const,
                    title: "Home User",
                    description: "Monitor your own household.",
                  },
                  {
                    value: "manager" as const,
                    title: "Property Manager",
                    description: "Manage tenant sub-meters.",
                  },
                ].map((option) => {
                  const selected = accountType === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setAccountType(option.value);
                        clearFieldError("accountType");
                      }}
                      className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                        selected
                          ? "border-mint bg-mint/10 text-fg"
                          : "border-fg/10 bg-fg/[0.03] text-fg/60"
                      }`}
                      aria-pressed={selected}
                    >
                      <span className="block text-sm font-bold">{option.title}</span>
                      <span className="mt-1 block text-[11px] leading-snug text-fg/45">
                        {option.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>

          <div className="mb-5">
            <label
              htmlFor="register-full-name"
              className="mb-2 block text-base font-semibold text-fg"
            >
              {accountType === "manager" ? "Property Name" : "Home Name"}
            </label>
            <input
              id="register-full-name"
              type="text"
              placeholder={
                accountType === "manager"
                  ? "e.g., Mabini Boarding House"
                  : "e.g., Santos Residence"
              }
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                clearFieldError("fullName");
              }}
              onBlur={() =>
                setFieldErrors((currentErrors) => ({
                  ...currentErrors,
                  fullName: validateFullName() ?? undefined,
                }))
              }
              required
              aria-invalid={Boolean(fieldErrors.fullName)}
              aria-describedby="register-full-name-message"
              className={getInputClass(Boolean(fieldErrors.fullName))}
            />
            <p
              id="register-full-name-message"
              className={`mt-2 text-xs ${
                fieldErrors.fullName ? "text-danger" : "text-fg/40"
              }`}
            >
              {fieldErrors.fullName ??
                (accountType === "manager"
                  ? "Example: Mabini Boarding House or CJS Rentals."
                  : "Example: Santos Residence or Unit 4B.")}
            </p>
          </div>

          <div className="mb-5">
            <label
              htmlFor="register-email"
              className="mb-2 block text-base font-semibold text-fg"
            >
              Email Address
            </label>
            <input
              id="register-email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearFieldError("email");
              }}
              onBlur={() =>
                setFieldErrors((currentErrors) => ({
                  ...currentErrors,
                  email:
                    validateEmailAddress(
                      email,
                      "Enter the email address you will use to log in."
                    ) ?? undefined,
                }))
              }
              autoComplete="email"
              required
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby="register-email-message"
              className={getInputClass(Boolean(fieldErrors.email))}
            />
            <p
              id="register-email-message"
              className={`mt-2 text-xs ${
                fieldErrors.email ? "text-danger" : "text-fg/40"
              }`}
            >
              {fieldErrors.email ??
                "We will use this for login and account recovery."}
            </p>
          </div>

          <div className="mb-2">
            <label
              htmlFor="register-password"
              className="mb-2 block text-base font-semibold text-fg"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="register-password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearFieldError("password");
                }}
                onBlur={() =>
                  setFieldErrors((currentErrors) => ({
                    ...currentErrors,
                    password: validatePassword() ?? undefined,
                  }))
                }
                autoComplete="new-password"
                required
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby="register-password-message"
                className={getInputClass(Boolean(fieldErrors.password), "pr-12")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-accent/60 transition-colors hover:text-accent"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <p
            id="register-password-message"
            className={`mb-6 text-xs ${
              fieldErrors.password ? "text-danger" : "text-fg/40"
            }`}
          >
            {fieldErrors.password ?? "Must be at least 8 characters long."}
          </p>

          <div className="mb-8">
            <label htmlFor="register-terms" className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-fg/70">
              <input
                id="register-terms"
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => {
                  setAcceptedTerms(e.target.checked);
                  clearFieldError("terms");
                }}
                aria-invalid={Boolean(fieldErrors.terms)}
                aria-describedby={fieldErrors.terms ? "register-terms-message" : undefined}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-[background-color,border-color,scale] duration-150 ease-out peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-mint active:scale-90 ${
                  acceptedTerms
                    ? "border-mint bg-mint text-ink"
                    : fieldErrors.terms
                      ? "border-danger/70"
                      : "border-mint/40"
                }`}
              >
                <Check
                  className={`h-3.5 w-3.5 transition-[opacity,scale] duration-150 ease-out ${acceptedTerms ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}
                  strokeWidth={3}
                />
              </span>
              <span>
                I have read and agree to the{" "}
                <Link href="/terms" target="_blank" rel="noopener" className="font-semibold text-accent hover:underline">
                  Terms and Conditions
                </Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" rel="noopener" className="font-semibold text-accent hover:underline">
                  Privacy Policy
                </Link>
                , including how WattWise processes my energy data.
              </span>
            </label>
            {fieldErrors.terms ? (
              <p id="register-terms-message" className="mt-2 pl-8 text-xs text-danger">
                {fieldErrors.terms}
              </p>
            ) : null}
          </div>

          <SubmitButton
            status={status}
            idleLabel="Sign Up"
            loadingLabel="Creating account..."
            successLabel="Account created! Setting things up..."
          />
        </form>

        <div className="mt-6 flex justify-center">
          <p className="text-sm text-fg/50">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-bold text-accent transition-colors hover:text-accent/80"
            >
              Log In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
