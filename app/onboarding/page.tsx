import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Activity, ArrowRight, BellRing, Plug, Power, ReceiptText, ScanLine, TrendingDown } from "lucide-react";
import Reveal from "@/components/landing/Reveal";
import SmoothScroll from "@/components/landing/SmoothScroll";
import { DevicePoster } from "@/components/landing/device/DevicePoster";
import WattWiseStage from "@/components/landing/device/WattWiseStage";

export const metadata: Metadata = {
  title: "Smart Energy. Real Savings.",
  description: "WattWise shows what every appliance costs in pesos, live, and cuts the power when a budget runs out.",
};

const FEATURES = [
  { icon: Activity, title: "Live per-appliance usage", body: "Watts, volts and amps from each WattWise unit, updated every few seconds." },
  { icon: ReceiptText, title: "Priced like your Meralco bill", body: "Every rate component, tier and VAT line from this month's schedule." },
  { icon: Power, title: "Budgets that act for you", body: "Set a limit per appliance and WattWise cuts power when it's reached." },
  { icon: BellRing, title: "Alerts before the bill does", body: "Spikes and budget warnings land on your phone while you can still act." },
] as const;

const STEPS = [
  { icon: Plug, title: "Plug it in", body: "Put a WattWise unit between the outlet and your appliance." },
  { icon: ScanLine, title: "Scan and name it", body: "Scan the unit's QR code and tell WattWise what's plugged in." },
  { icon: TrendingDown, title: "Watch it, then save", body: "See the peso cost live and trim the appliances that burn the most." },
] as const;

const PRIMARY_CTA =
  "group inline-flex h-13 items-center justify-center gap-2 rounded-full bg-mint px-7 text-base font-bold text-ink transition-[scale,background-color] duration-150 ease-out hover:bg-mint/90 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint";
const SECONDARY_CTA =
  "inline-flex h-13 items-center justify-center rounded-full border border-fg/15 px-7 text-base font-bold text-fg transition-[scale,background-color,border-color] duration-150 ease-out hover:border-fg/30 hover:bg-fg/5 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint";

function CallToAction() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Link href="/register" className={PRIMARY_CTA}>
        Get started
        <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
      <Link href="/login" className={SECONDARY_CTA}>
        Log in
      </Link>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="relative overflow-x-clip bg-canvas tracking-tight">
      <SmoothScroll />
      {/* Ambient light behind the unit */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[110dvh] bg-radial-[at_70%_40%] from-mint/[0.09] to-transparent to-60% max-lg:bg-radial-[at_50%_25%]"
      />

      {/* Hero */}
      <section className="relative mx-auto grid min-h-dvh max-w-6xl items-center gap-4 px-6 pb-16 pt-8 lg:grid-cols-[1fr_1.1fr] lg:gap-8 lg:px-10 lg:py-16">
        <div className="order-2 flex flex-col items-center text-center lg:order-1 lg:items-start lg:text-left">
          <p className="ww-rise flex items-center gap-2 text-lg font-bold text-fg">
            <Image src="/wattwise_mascot.png" alt="" width={32} height={32} priority className="h-8 w-8 object-contain" />
            <span>
              Watt<span className="text-accent">Wise</span>
            </span>
          </p>
          <h1
            className="ww-rise mt-6 text-5xl font-bold leading-[0.98] tracking-tighter text-fg sm:text-6xl xl:text-7xl"
            style={{ animationDelay: "80ms" }}
          >
            Smart Energy.
            <br />
            <span className="text-accent">Real Savings.</span>
          </h1>
          <p className="ww-rise mt-5 max-w-md text-lg leading-relaxed text-fg/60" style={{ animationDelay: "160ms" }}>
            See what every appliance costs in pesos, live, and let WattWise cut the power when a budget runs out.
          </p>
          <div className="ww-rise mt-8 w-full sm:w-auto" style={{ animationDelay: "240ms" }}>
            <CallToAction />
          </div>
        </div>

        <div className="ww-rise order-1 w-full lg:order-2" style={{ animationDelay: "120ms" }}>
          <WattWiseStage poster={<DevicePoster className="h-auto w-[min(60%,420px)]" />} />
        </div>
      </section>

      {/* Features */}
      <section className="relative mx-auto max-w-6xl px-6 py-20 lg:px-10 lg:py-28">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent/80">What you get</p>
          <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tighter text-fg sm:text-4xl lg:text-5xl">
            One plug. The whole picture.
          </h2>
        </Reveal>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, body }, index) => (
            <li key={title}>
              <Reveal delay={index * 70} className="h-full">
                <div className="h-full rounded-3xl border border-fg/5 bg-surface p-7 lg:p-8">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint/10 text-accent">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-6 text-xl font-bold text-fg">{title}</h3>
                  <p className="mt-2 leading-relaxed text-fg/55">{body}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      {/* How it works */}
      <section className="relative mx-auto max-w-6xl px-6 py-20 lg:px-10 lg:py-28">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent/80">How it works</p>
          <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tighter text-fg sm:text-4xl lg:text-5xl">
            Set up in a minute.
          </h2>
        </Reveal>
        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-6">
          {STEPS.map(({ icon: Icon, title, body }, index) => (
            <li key={title}>
              <Reveal delay={index * 90}>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold tabular-nums text-accent">0{index + 1}</span>
                  <span className="h-px flex-1 bg-fg/10" />
                  <Icon className="h-5 w-5 text-fg/40" aria-hidden="true" />
                </div>
                <h3 className="mt-6 text-xl font-bold text-fg">{title}</h3>
                <p className="mt-2 leading-relaxed text-fg/55">{body}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      {/* Closing call to action */}
      <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-12 lg:px-10 lg:pb-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-[32px] border border-fg/5 bg-surface bg-radial-[at_50%_0%] from-mint/[0.12] to-transparent to-70% px-6 py-16 text-center sm:px-12 lg:py-20">
            <h2 className="mx-auto max-w-xl text-balance text-3xl font-bold leading-tight tracking-tighter text-fg sm:text-4xl lg:text-5xl">
              Start saving this billing cycle.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-lg text-fg/60">Take control of your household energy, one appliance at a time.</p>
            <div className="mt-8 flex justify-center">
              <CallToAction />
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 border-t border-fg/5 px-6 py-8 text-sm text-fg/40 sm:flex-row lg:px-10">
        <p>
          <span className="font-bold text-fg/70">
            Watt<span className="text-accent">Wise</span>
          </span>{" "}
          · Built for Philippine households.
        </p>
        <p>Optimized for sustainable living.</p>
      </footer>
    </main>
  );
}
