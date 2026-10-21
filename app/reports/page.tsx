import Link from "next/link";
import { getSessionUser } from "@/lib/auth-context";
import { redirect } from "next/navigation";
import BottomNav from "@/components/ui/BottomNav";
import PageHeader from "@/components/ui/PageHeader";
import { FileText } from "lucide-react";
import ReportTable from "@/components/reports/ReportTable";
import ReportExportButtons from "@/components/reports/ReportExportButtons";

const periods = ["daily", "weekly", "monthly"] as const;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const period: (typeof periods)[number] = periods.includes(params.period as (typeof periods)[number])
    ? (params.period as (typeof periods)[number])
    : "monthly";

  return (
    <div className="min-h-screen bg-canvas pb-24 text-white print:bg-white print:text-black">
      <PageHeader icon={FileText} title="Energy Reports" />
      <main className="px-5 pb-6 pt-[84px] print:pt-6">
        <div className="mb-6 flex gap-2 print:hidden">{periods.map((item) => <Link key={item} href={`/reports?period=${item}`} aria-current={item === period ? "page" : undefined} className={`inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-bold uppercase ${item === period ? "bg-surface text-mint" : "text-white/50"}`}>{item}</Link>)}</div>
        <p className="mb-6 text-sm text-white/50 print:text-black/60">Choose a period, review the totals, then download a ready-to-share PDF or CSV.</p>
        <ReportExportButtons period={period} />
        <ReportTable period={period} />
      </main>
      <BottomNav />
    </div>
  );
}
