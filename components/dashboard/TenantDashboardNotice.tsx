import { PlugZap } from "@/components/ui/icons";
import BottomNav from "@/components/ui/BottomNav";
import PageHeader from "@/components/ui/PageHeader";

export default function TenantDashboardNotice({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="min-h-screen bg-canvas lg:min-h-0 pb-24 text-fg lg:pb-12">
      <PageHeader title={<>Watt<span className="text-accent">Wise</span></>} />

      <main className="flex min-h-screen items-center px-5 lg:min-h-[60vh] pt-[84px] lg:pt-0">
        <section className="w-full rounded-2xl border border-fg/[0.06] bg-surface p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-mint/10">
            <PlugZap className="h-7 w-7 text-accent" />
          </div>
          <h2 className="mt-5 text-2xl font-bold tracking-tight">{title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-fg/55">
            {description}
          </p>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
