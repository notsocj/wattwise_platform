"use client";

import { useEffect, useState } from "react";

type ReportRow = {
  device_name: string;
  appliance_type: string;
  measured_kwh: number;
  estimated_kwh: number | null;
  difference_kwh: number | null;
  difference_percent: number | null;
  average_watts: number;
  variable_cost_php: number;
  budget_percent: number | null;
};

export default function ReportTable({ period }: { period: string }) {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reports?period=${period}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Report data could not be loaded.");
        return response.json() as Promise<{ rows: ReportRow[] }>;
      })
      .then((payload) => { if (!cancelled) setRows(payload.rows ?? []); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Report data could not be loaded."); });
    return () => { cancelled = true; };
  }, [period]);

  return <section className="overflow-x-auto rounded-xl border border-white/[0.08] bg-surface p-5 print:border-black/10 print:bg-white">
    <h2 className="mb-4 text-sm font-bold uppercase tracking-widest">{period} appliance comparison</h2>
    {error ? <p className="text-sm text-danger">{error}</p> : rows.length === 0 ? <p className="text-sm text-white/50 print:text-black/60">No registered appliances or telemetry for this period.</p> : <table className="w-full min-w-[680px] text-left text-xs"><thead><tr className="border-b border-white/10 text-white/45 print:border-black/10 print:text-black/50"><th className="py-2">Appliance</th><th>Actual kWh</th><th>Estimated kWh</th><th>Difference</th><th>Avg watts</th><th>Variable cost</th><th>Limit used</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.device_name}-${row.appliance_type}`} className="border-b border-white/[0.06] print:border-black/10"><td className="py-3 font-semibold">{row.device_name}<span className="ml-2 text-white/40 print:text-black/40">{row.appliance_type}</span></td><td>{row.measured_kwh.toFixed(4)}</td><td>{row.estimated_kwh === null ? "—" : row.estimated_kwh.toFixed(4)}</td><td>{row.difference_kwh === null ? "—" : `${row.difference_kwh.toFixed(4)} (${row.difference_percent?.toFixed(1)}%)`}</td><td>{row.average_watts.toFixed(1)} W</td><td>₱{row.variable_cost_php.toFixed(2)}</td><td>{row.budget_percent === null ? "—" : `${row.budget_percent.toFixed(1)}%`}</td></tr>)}</tbody></table>}
  </section>;
}
