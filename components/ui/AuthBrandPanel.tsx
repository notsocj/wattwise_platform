import Image from "next/image";
import { Activity, Power, ReceiptText } from "lucide-react";

const FEATURES = [
  { icon: Activity, title: "Live per-appliance usage", body: "Watts, volts, and amps from each WattWise unit, every few seconds." },
  { icon: ReceiptText, title: "Priced like your Meralco bill", body: "Every rate component, tier, and VAT line from this month's schedule." },
  { icon: Power, title: "Budgets that act for you", body: "Set a limit per appliance and WattWise cuts power when it's reached." },
] as const;

/** Left half of the sign-in pages on desktop (lg+). Hidden on phones. */
export default function AuthBrandPanel() {
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col justify-between overflow-hidden border-r border-fg/5 bg-surface bg-radial-[at_20%_15%] from-mint/[0.08] to-transparent to-60% px-12 py-10 lg:flex xl:px-16">
      <p className="ww-rise text-xl font-bold tracking-tight text-fg">
        Watt<span className="text-accent">Wise</span>
      </p>

      <div className="max-w-md">
        <Image
          src="/wattwise_mascot.png"
          alt=""
          width={112}
          height={112}
          priority
          className="ww-rise mb-8 h-24 w-24 object-contain"
          style={{ animationDelay: "60ms" }}
        />
        <h2 className="ww-rise text-5xl font-bold leading-[1.05] tracking-tight text-fg" style={{ animationDelay: "120ms" }}>
          Smart Energy.
          <br />
          <span className="text-accent">Real Savings.</span>
        </h2>
        <p className="ww-rise mt-4 text-lg leading-relaxed text-fg/60" style={{ animationDelay: "180ms" }}>
          Take control of your household energy, one appliance at a time.
        </p>

        <ul className="mt-10 space-y-5">
          {FEATURES.map(({ icon: Icon, title, body }, index) => (
            <li key={title} className="ww-rise flex gap-4" style={{ animationDelay: `${240 + index * 60}ms` }}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint/10 text-accent">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-fg">{title}</span>
                <span className="mt-0.5 block text-sm text-fg/50">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-fg/40">Built for Philippine households.</p>
    </aside>
  );
}
