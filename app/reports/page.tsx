import Link from "next/link";
import { redirect } from "next/navigation";
import BottomNav from "@/components/ui/BottomNav";
import LogoutButton from "@/components/ui/LogoutButton";
import ReportTable from "@/components/reports/ReportTable";
import { createClient } from "@/lib/supabase/server";

const periods = ["daily", "weekly", "monthly"] as const;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const period: (typeof periods)[number] = periods.includes(params.period as (typeof periods)[number])
    ? (params.period as (typeof periods)[number])
    : "monthly";

  return (
    <div className="min-h-screen bg-base pb-24 text-white print:bg-white print:text-black">
      <header className="mx-auto flex max-w-[760px] items-center justify-between border-b border-white/10 px-5 py-5 print:border-black/10">
        <div><p className="text-xs uppercase tracking-widest text-mint print:text-black/60">WattWise</p><h1 className="text-2xl font-bold">Energy Reports</h1></div>
        <div className="flex items-center gap-2 print:hidden">
          <a className="rounded-lg bg-mint px-3 py-2 text-xs font-bold text-base" href={`/api/reports?period=${period}&format=pdf`}>Download PDF</a>
          <a className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold" href={`/api/reports?period=${period}&format=csv`}>CSV</a>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-[760px] px-5 py-6">
        <div className="mb-6 flex gap-2 print:hidden">{periods.map((item) => <Link key={item} href={`/reports?period=${item}`} className={`rounded-lg px-3 py-2 text-xs font-bold uppercase ${item === period ? "bg-surface text-mint" : "text-white/45"}`}>{item}</Link>)}</div>
        <p className="mb-6 text-sm text-white/50 print:text-black/60">Choose a period, review the totals, then download a ready-to-share PDF or CSV.</p>
        <ReportTable period={period} />
      </main>
      <BottomNav />
    </div>
  );
}
