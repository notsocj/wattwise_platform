import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/server";
import { buildEnergyReport, parseReportPeriod } from "@/lib/reports";
import { buildReportPdf } from "@/lib/report-pdf";

function csvCell(value: string | number | null): string {
  const raw = value === null ? "" : String(value);
  return `"${raw.replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const period = parseReportPeriod(request.nextUrl.searchParams.get("period"));
  let report;
  try {
    report = await buildEnergyReport(supabase, user, period);
  } catch (error) {
    console.error("reports:", error);
    return NextResponse.json({ error: "Report data could not be loaded." }, { status: 500 });
  }
  const { start, end, rows, activeRates } = report;

  const format = request.nextUrl.searchParams.get("format") ?? "json";
  if (format === "pdf") {
    const pdf = await buildReportPdf({
      accountEmail: user.email ?? "WattWise account",
      period,
      start,
      end,
      rows,
    });
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="wattwise-${period}-report.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  if (format === "csv") {
    const headers = Object.keys(rows[0] ?? {
      device_name: "", appliance_type: "", measured_kwh: "", estimated_kwh: "",
      difference_kwh: "", difference_percent: "", average_watts: "",
      variable_cost_php: "", limit_php: "", budget_percent: "", generation_rate: "",
      transmission_rate: "", ancillary_service_rate: "", distribution_rate: "", system_loss_rate: "",
      supply_rate: "", metering_rate: "",
      universal_charges_rate: "", fit_all_rate: "", adjustments_rate: "", vat_rate: "",
      vat_generation_rate: "", vat_transmission_rate: "", vat_ancillary_rate: "",
      variable_rate_per_kwh: "", fixed_charges_php: "",
    });
    const csv = [headers, ...rows.map((row) => headers.map((header) => row[header as keyof typeof row]))]
      .map((line) => line.map((value) => csvCell(value as string | number | null)).join(","))
      .join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="wattwise-${period}-report.csv"`,
      },
    });
  }

  return NextResponse.json({
    period,
    start: start.toISOString(),
    end: end.toISOString(),
    meralco: {
      ...activeRates.rates,
      vat_rate: activeRates.vatRate,
      metering_charge: activeRates.fixedCharges.meteringCharge,
      supply_charge: activeRates.fixedCharges.supplyCharge,
    },
    rows,
  });
}
