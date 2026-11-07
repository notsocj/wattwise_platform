import Link from "next/link";
import { getSessionUser } from "@/lib/auth-context";
import { redirect } from "next/navigation";
import BottomNav from "@/components/ui/BottomNav";
import PageHeader from "@/components/ui/PageHeader";
import { FileText } from "@/components/ui/icons";
import ReportTable from "@/components/reports/ReportTable";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { buildEnergyReport, parseReportPeriod, REPORT_PERIODS, type ReportPeriod } from "@/lib/reports";
import type { SessionUser } from "@/lib/auth-context";

const periods = REPORT_PERIODS;

// Builds the report on the server and streams it in under Suspense, so the
// page shell shows immediately and no second request starts after load.
async function ReportSection({ user, period }: { user: SessionUser; period: ReportPeriod }) {
  const report = await buildEnergyReport(await createClient(), user, period).catch((error: unknown) => {
    console.error("reports page:", error);
    return null;
  });
  return report ? (
    <ReportTable period={period} rows={report.rows} />
  ) : (
    <ReportTable period={period} rows={[]} error="We couldn't load this report. Refresh to try again." />
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const period = parseReportPeriod(params.period);

  return (
    <div className="min-h-screen bg-canvas lg:min-h-0 pb-24 text-fg lg:pb-12 print:bg-white print:text-black">
      <PageHeader icon={FileText} title="Energy Reports" description="Review your usage and cost by period, then download a PDF or CSV." />
      <main className="ww-stagger px-5 pb-6 pt-[84px] lg:pt-0 print:pt-6">
        <div className="mb-6 inline-flex gap-1 rounded-full border border-fg/[0.06] bg-surface p-1 print:hidden">{periods.map((item) => <Link key={item} href={`/reports?period=${item}`} aria-current={item === period ? "page" : undefined} className={`inline-flex min-h-9 items-center rounded-full px-4 text-sm font-semibold capitalize transition-colors duration-150 ease-out ${item === period ? "bg-fg/[0.08] text-fg" : "text-fg/50 hover:text-fg"}`}>{item}</Link>)}</div>
        <p className="mb-6 text-sm text-fg/50 lg:hidden print:text-black/60">Choose a period, review the totals, then download a ready-to-share PDF or CSV.</p>
        <ReportExportButtons period={period} />
        <Suspense key={period} fallback={<ReportTable period={period} rows={null} />}>
          <ReportSection user={user} period={period} />
        </Suspense>
      </main>
      <BottomNav />
    </div>
  );
}
