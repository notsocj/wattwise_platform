import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '404 Not Found',
};

export default function NotFound() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-base px-6 py-12 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,230,111,0.15),_transparent_55%)]" />

      <section className="relative mx-auto flex min-h-[75vh] w-full max-w-md items-center justify-center">
        <div className="w-full rounded-xl border border-white/10 bg-surface/95 p-8 text-center shadow-[0_20px_50px_rgba(0,0,0,0.4)] backdrop-blur-sm">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-mint/80">
            Error 404
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Page not found
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            The page you opened does not exist. Use the button below to return
            to the app.
          </p>

          <div className="mt-7 flex justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg bg-mint px-5 py-2.5 text-sm font-semibold text-black transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/70 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
            >
              Return to App
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
