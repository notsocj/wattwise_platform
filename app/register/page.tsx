"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import LoadingIndicator from "@/components/ui/LoadingIndicator";
import { getHomePathForRole, type UserRole } from "@/lib/roles";
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
}>;

type RegisterRole = Extract<UserRole, "user" | "manager">;

const inputBaseClass =
  "w-full bg-transparent rounded-xl px-4 py-4 text-white placeholder-white/30 text-base focus:outline-none transition-colors";

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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [loading, setLoading] = useState(false);

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

    setLoading(true);
    const supabase = createClient();
    const normalizedEmail = normalizeEmail(email);
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role: accountType,
        },
      },
    });
    setLoading(false);

    if (signUpError) {
      setSubmitError(getFriendlyAuthError(signUpError.message, "register"));
      return;
    }

    // The trigger should persist role metadata. This fallback covers older
    // trigger versions and races where the profile row already exists.
    if (signUpData.user) {
      await supabase.from("profiles").upsert({
        id: signUpData.user.id,
        email: normalizedEmail,
        full_name: fullName.trim(),
        role: accountType,
      });
    }

    router.push(getHomePathForRole(accountType));
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-base tracking-tight">
      <div className="flex flex-col items-center px-6 pb-6 pt-16">
        <div className="flex h-24 w-24 items-center justify-center">
          <Image
            src="/wattwise_mascot.png"
            alt="WattWise mascot"
            width={72}
            height={72}
            className="h-20 w-20 object-contain"
          />
        </div>

        <h1 className="text-3xl font-bold text-white">
          Watt<span className="text-mint">Wise</span>
        </h1>

        <p className="text-[10px] font-semibold tracking-[0.4em] text-mint/70">
          INTELLIGENT ENERGY
        </p>
      </div>

      <div className="flex flex-1 flex-col px-6 pt-2">
        <h2 className="mb-6 text-xl font-bold text-white">Create Account</h2>

        {submitError && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            {submitError}
          </div>
        )}

        <form onSubmit={handleRegister} noValidate>
          <div className="mb-5">
            <fieldset>
              <legend className="mb-2 block text-base font-semibold text-white">
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
                          ? "border-mint bg-mint/10 text-white"
                          : "border-white/10 bg-white/[0.03] text-white/60"
                      }`}
                      aria-pressed={selected}
                    >
                      <span className="block text-sm font-bold">{option.title}</span>
                      <span className="mt-1 block text-[11px] leading-snug text-white/45">
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
              className="mb-2 block text-base font-semibold text-white"
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
                fieldErrors.fullName ? "text-danger" : "text-white/40"
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
              className="mb-2 block text-base font-semibold text-white"
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
                fieldErrors.email ? "text-danger" : "text-white/40"
              }`}
            >
              {fieldErrors.email ??
                "We will use this for login and account recovery."}
            </p>
          </div>

          <div className="mb-2">
            <label
              htmlFor="register-password"
              className="mb-2 block text-base font-semibold text-white"
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
                className="absolute right-4 top-1/2 -translate-y-1/2 text-mint/60 transition-colors hover:text-mint"
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
            className={`mb-8 text-xs ${
              fieldErrors.password ? "text-danger" : "text-white/40"
            }`}
          >
            {fieldErrors.password ?? "Must be at least 8 characters long."}
          </p>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-xl bg-mint py-4 text-[17px] font-bold text-black transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <LoadingIndicator
                  size="sm"
                  label="Creating account"
                  showLabel={false}
                  spinnerClassName="border-black/30 border-t-black"
                />
                Creating account...
              </span>
            ) : (
              "Sign Up"
            )}
          </button>
        </form>

        <div className="mt-6 flex justify-center">
          <p className="text-sm text-white/50">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-bold text-mint transition-colors hover:text-mint/80"
            >
              Log In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
