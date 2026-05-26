'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import LoadingIndicator from '@/components/ui/LoadingIndicator';

type UpdatePasswordFormProps = {
  mode?: 'update' | 'reset';
  backHref?: string;
};

type SessionState = 'checking' | 'ready' | 'missing';

export default function UpdatePasswordForm({
  mode = 'update',
  backHref = '/dashboard',
}: UpdatePasswordFormProps) {
  const router = useRouter();
  const [sessionState, setSessionState] = useState<SessionState>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function prepareSession() {
      const code = new URLSearchParams(window.location.search).get('code');

      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError && isMounted) {
          setError(exchangeError.message);
        }

        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (isMounted) {
        setSessionState(session ? 'ready' : 'missing');
      }
    }

    prepareSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setSessionState('ready');
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
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
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
        return;
      }

      setPassword('');
      setConfirmPassword('');
      setSuccess(true);

      if (mode === 'reset') {
        await supabase.auth.signOut();
        setTimeout(() => {
          router.replace('/login');
        }, 1800);
        return;
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setLoading(false);
    }
  }

  if (sessionState === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base px-6 text-white">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4">
          <LoadingIndicator size="md" label="Preparing secure session" />
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-base px-6 text-white">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-bida/10">
          <CheckCircle2 className="h-8 w-8 text-bida" />
        </div>
        <h1 className="mb-2 text-2xl font-bold">Password Updated</h1>
        <p className="mb-8 max-w-sm text-center text-sm leading-6 text-white/50">
          {mode === 'reset'
            ? 'Your password has been updated successfully. Redirecting to login...'
            : 'Your WattWise account password has been changed successfully.'}
        </p>
        {mode === 'reset' ? (
          <LoadingIndicator size="sm" label="Redirecting" />
        ) : (
          <Link
            href={backHref}
            className="inline-flex w-full max-w-sm items-center justify-center rounded-xl bg-mint px-4 py-4 text-[17px] font-bold text-black transition-transform active:scale-95"
          >
            Continue
          </Link>
        )}
      </div>
    );
  }

  if (sessionState === 'missing') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-base px-6 text-white">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-danger/10">
          <KeyRound className="h-8 w-8 text-danger" />
        </div>
        <h1 className="mb-2 text-2xl font-bold">Reset Link Required</h1>
        <p className="mb-8 max-w-sm text-center text-sm leading-6 text-white/50">
          Open this page from your password reset email, or sign in first to update
          your password from your account.
        </p>
        <div className="flex w-full max-w-sm flex-col gap-3">
          <Link
            href="/forgot-password"
            className="inline-flex items-center justify-center rounded-xl bg-mint px-4 py-4 text-[17px] font-bold text-black transition-transform active:scale-95"
          >
            Request Reset Link
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-4 text-sm font-semibold text-mint transition-colors hover:border-mint/40"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-base tracking-tight text-white">
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
          Watt<span className="text-mint">Wise</span>
        </h1>
        <p className="text-[10px] font-semibold tracking-[0.4em] text-mint/70">
          {mode === 'reset' ? 'RESET PASSWORD' : 'UPDATE PASSWORD'}
        </p>
      </div>

      <div className="flex flex-1 flex-col px-6 pt-4">
        {error && (
          <div className="mb-5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="mb-2 block text-base font-semibold text-white">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-mint/40 bg-transparent px-4 py-4 pr-12 text-base text-white placeholder-white/30 transition-colors focus:border-mint focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-mint/60 transition-colors hover:text-mint"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
            <p className="mt-2 text-sm text-white/40">
              Use at least 8 characters.
            </p>
          </div>

          <div className="mb-8">
            <label className="mb-2 block text-base font-semibold text-white">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-mint/40 bg-transparent px-4 py-4 pr-12 text-base text-white placeholder-white/30 transition-colors focus:border-mint focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                aria-label={
                  showConfirmPassword ? 'Hide confirmation' : 'Show confirmation'
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 text-mint/60 transition-colors hover:text-mint"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !password || !confirmPassword}
            className="inline-flex w-full items-center justify-center rounded-xl bg-mint py-4 text-[17px] font-bold text-black transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
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
              'Update Password'
            )}
          </button>
        </form>

        <div className="mt-6 flex justify-center">
          <Link
            href={backHref}
            className="flex items-center gap-2 text-sm font-semibold text-mint transition-colors hover:text-mint/80"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>
      </div>
    </div>
  );
}
