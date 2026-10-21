"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-canvas px-6 py-12 text-white">
      <section className="relative mx-auto flex min-h-[75vh] w-full max-w-md items-center justify-center">
        <div
          role="alert"
          className="w-full rounded-xl border border-white/10 bg-surface/95 p-8 text-center shadow-[0_20px_50px_rgba(0,0,0,0.4)] backdrop-blur-sm"
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-naku">
            Something went wrong
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            We couldn&apos;t load this page
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            Your data is safe. This is usually a brief connection problem. Try again, or head
            back to the app.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-mint px-5 text-sm font-semibold text-ink transition hover:brightness-110"
            >
              Try again
            </button>
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-white/10 px-5 text-sm font-semibold text-white/80 transition hover:bg-white/5"
            >
              Return to App
            </Link>
          </div>
          {error.digest ? (
            <p className="mt-5 text-[11px] text-white/50">Reference: {error.digest}</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
