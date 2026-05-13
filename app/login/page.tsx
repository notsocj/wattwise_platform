"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  getFriendlyAuthError,
  normalizeEmail,
  validateEmailAddress,
} from "@/lib/user-form-messages";

type LoginFieldErrors = Partial<{
  email: string;
  password: string;
}>;

const inputBaseClass =
  "w-full bg-transparent rounded-xl px-4 py-4 text-white placeholder-white/30 text-base focus:outline-none transition-colors";

function getInputClass(hasError: boolean, extraClass = ""): string {
  const stateClass = hasError
    ? "border border-danger/70 focus:border-danger"
    : "border border-mint/40 focus:border-mint";

  return `${inputBaseClass} ${stateClass} ${extraClass}`;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(
    searchParams.get("error") === "unauthorized"
      ? "You do not have permission to access that page."
      : null
  );
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [loading, setLoading] = useState(false);

  function validatePassword(value = password): string | null {
    return value ? null : "Enter your password.";
  }

  function validateForm(): LoginFieldErrors {
    const nextErrors: LoginFieldErrors = {};
    const emailError = validateEmailAddress(
      email,
      "Enter your email address to log in."
    );
    const passwordError = validatePassword();

    if (emailError) nextErrors.email = emailError;
    if (passwordError) nextErrors.password = passwordError;

    return nextErrors;
  }

  function clearFieldError(field: keyof LoginFieldErrors) {
    setSubmitError(null);
    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }));
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const nextErrors = validateForm();
    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setSubmitError("Please fix the highlighted fields before logging in.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });

    if (signInError) {
      setSubmitError(getFriendlyAuthError(signInError.message, "login"));
      setLoading(false);
      return;
    }

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

      <div className="flex flex-1 flex-col px-6 pt-6">
        {submitError && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            {submitError}
          </div>
        )}

        <form onSubmit={handleLogin} noValidate>
          <div className="mb-5">
            <label
              htmlFor="login-email"
              className="mb-2 block text-base font-semibold text-white"
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              placeholder="Enter your email"
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
                      "Enter your email address to log in."
                    ) ?? undefined,
                }))
              }
              autoComplete="email"
              required
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby="login-email-message"
              className={getInputClass(Boolean(fieldErrors.email))}
            />
            <p
              id="login-email-message"
              className={`mt-2 text-xs ${
                fieldErrors.email ? "text-danger" : "text-white/40"
              }`}
            >
              {fieldErrors.email ?? "Use the email you registered with WattWise."}
            </p>
          </div>

          <div className="mb-3">
            <label
              htmlFor="login-password"
              className="mb-2 block text-base font-semibold text-white"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
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
                autoComplete="current-password"
                required
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby="login-password-message"
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
            {fieldErrors.password ? (
              <p id="login-password-message" className="mt-2 text-xs text-danger">
                {fieldErrors.password}
              </p>
            ) : (
              <p id="login-password-message" className="sr-only">
                Enter your WattWise password.
              </p>
            )}
          </div>

          <div className="mb-8 flex justify-end">
            <Link
              href="/forgot-password"
              className="text-sm font-semibold text-mint transition-colors hover:text-mint/80"
            >
              Forgot Password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-mint py-4 text-[17px] font-bold text-black transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="mt-6 flex justify-center">
          <p className="text-sm text-white/50">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-bold text-mint transition-colors hover:text-mint/80"
            >
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
