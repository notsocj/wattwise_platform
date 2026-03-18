import { KpiCard } from "@/components/dashboard/KpiCard";
import { siteConfig } from "@/lib/config/site";
import { sampleEnergySummary } from "@/lib/data/sample-energy";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-[var(--color-surface)] px-6 py-16 text-[var(--color-ink)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-[var(--color-accent)]">
            {siteConfig.name}
          </p>
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold tracking-tight">
              Dashboard foundation
            </h1>
            <p className="max-w-2xl text-base text-[var(--color-muted)]">
              This starter route gives the project a clear landing zone for
              charts, controls, and API-backed metrics as the product grows.
            </p>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <KpiCard
            label="Today&apos;s usage"
            value={`${sampleEnergySummary.todayKwh.toFixed(1)} kWh`}
            description="Seed metric pulled from the starter data module."
          />
          <KpiCard
            label="Projected bill"
            value={`PHP ${sampleEnergySummary.projectedBillPhp.toFixed(2)}`}
            description="Derived from the initial Meralco rate helper."
          />
          <KpiCard
            label="Active devices"
            value={sampleEnergySummary.activeDevices.toString()}
            description="Ready to connect with live hardware status."
          />
        </section>
      </div>
    </main>
  );
}
