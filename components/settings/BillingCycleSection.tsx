"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LoadingIndicator from "@/components/ui/LoadingIndicator";
import type { ShowSettingsToast } from "@/components/settings/settings-types";
import { distributionTierLabel } from "@/lib/meralco-bill";

function parseMonthlyKwh(value: string): number | null {
  const normalized = value.replace(/kwh/gi, "").replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const kwh = Number(normalized);
  return kwh > 0 && kwh <= 100000 ? kwh : null;
}

export default function BillingCycleSection({
  billingCycleStartDay,
  meralcoMonthlyKwh,
  onToast,
}: {
  billingCycleStartDay: number;
  meralcoMonthlyKwh: number | null;
  onToast: ShowSettingsToast;
}) {
  const router = useRouter();
  const [billingCycleDraft, setBillingCycleDraft] = useState(String(billingCycleStartDay));
  const [billingCycleError, setBillingCycleError] = useState<string | null>(null);
  const [isSavingBillingCycle, setIsSavingBillingCycle] = useState(false);

  const [kwhDraft, setKwhDraft] = useState(meralcoMonthlyKwh === null ? "" : String(meralcoMonthlyKwh));
  const [kwhError, setKwhError] = useState<string | null>(null);
  const [isSavingKwh, setIsSavingKwh] = useState(false);

  useEffect(() => {
    setBillingCycleDraft(String(billingCycleStartDay));
  }, [billingCycleStartDay]);

  useEffect(() => {
    setKwhDraft(meralcoMonthlyKwh === null ? "" : String(meralcoMonthlyKwh));
  }, [meralcoMonthlyKwh]);

  const draftKwh = parseMonthlyKwh(kwhDraft);

  async function saveMonthlyKwh(clear: boolean) {
    const value = clear ? null : draftKwh;
    if (!clear && value === null) {
      setKwhError("Enter the kWh from your Meralco bill, like 250 or 312.5.");
      return;
    }

    setIsSavingKwh(true);
    setKwhError(null);
    onToast(null);
    try {
      const response = await fetch("/api/profile/billing-cycle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meralco_monthly_kwh: value }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message =
          typeof payload.error === "string" ? payload.error : "We could not save your monthly kWh right now.";
        setKwhError(message);
        onToast({ type: "error", message });
        return;
      }
      if (clear) setKwhDraft("");
      onToast({
        type: "success",
        message: clear ? "Monthly kWh cleared. WattWise will use your monitored usage." : "Monthly kWh saved.",
      });
      router.refresh();
    } catch {
      const message = "Network error while saving your monthly kWh.";
      setKwhError(message);
      onToast({ type: "error", message });
    } finally {
      setIsSavingKwh(false);
    }
  }

  async function saveBillingCycle() {
    const parsedDay = Number(billingCycleDraft);

    if (!Number.isInteger(parsedDay) || parsedDay < 1 || parsedDay > 28) {
      setBillingCycleError("Choose a billing start date from 1 to 28.");
      return;
    }

    setIsSavingBillingCycle(true);
    setBillingCycleError(null);
    onToast(null);

    try {
      const response = await fetch("/api/profile/billing-cycle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billing_cycle_start_day: parsedDay }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message =
          typeof payload.error === "string"
            ? payload.error
            : "We could not save your billing cycle date right now.";
        setBillingCycleError(message);
        onToast({ type: "error", message });
        return;
      }

      onToast({
        type: "success",
        message: "Billing cycle date saved.",
      });
      router.refresh();
    } catch {
      const message = "Network error while saving billing cycle date.";
      setBillingCycleError(message);
      onToast({ type: "error", message });
    } finally {
      setIsSavingBillingCycle(false);
    }
  }

  return (
      <section className="rounded-xl border border-white/[0.06] bg-surface p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider">
          Billing Cycle
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-white/45">
          Set the Meralco reading date that starts your bill cycle. WattWise will
          use this for wallet totals, analytics forecasts, and Smart Control cutoffs.
        </p>

        <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
          <label
            htmlFor="billing-cycle-start-day"
            className="text-[11px] font-semibold uppercase tracking-wider text-white/50"
          >
            Meralco Billing Start Date
          </label>
          <div className="mt-3 flex items-center gap-3">
            <select
              id="billing-cycle-start-day"
              value={billingCycleDraft}
              disabled={isSavingBillingCycle}
              onChange={(event) => {
                setBillingCycleDraft(event.target.value);
                if (billingCycleError) {
                  setBillingCycleError(null);
                }
              }}
              className="h-11 flex-1 rounded-xl border border-white/10 bg-black/10 px-3 text-sm font-semibold text-white outline-none transition-colors focus:border-mint/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
                <option key={day} value={String(day)} className="bg-surface text-white">
                  {day}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void saveBillingCycle()}
              disabled={isSavingBillingCycle}
              className="inline-flex h-11 min-w-[104px] items-center justify-center gap-2 rounded-xl border border-mint/30 bg-mint/10 px-4 text-sm font-bold text-mint transition-colors hover:bg-mint/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingBillingCycle ? (
                <>
                  <LoadingIndicator size="sm" label="Saving" showLabel={false} />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>

          <p className={`mt-3 text-xs ${billingCycleError ? "text-danger" : "text-white/45"}`}>
            {billingCycleError
              ? billingCycleError
              : "Allowed values are 1 through 28 to match real Meralco reading windows safely."}
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
          <label
            htmlFor="meralco-monthly-kwh"
            className="text-[11px] font-semibold uppercase tracking-wider text-white/50"
          >
            Monthly kWh on your Meralco bill (optional)
          </label>
          <div className="mt-3 flex items-center gap-3">
            <input
              id="meralco-monthly-kwh"
              inputMode="decimal"
              autoComplete="off"
              placeholder="e.g. 250"
              value={kwhDraft}
              disabled={isSavingKwh}
              aria-invalid={kwhError ? true : undefined}
              onChange={(event) => {
                setKwhDraft(event.target.value);
                if (kwhError) setKwhError(null);
              }}
              className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/10 px-3 text-base font-semibold text-white outline-none transition-colors placeholder:text-white/30 focus:border-mint/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void saveMonthlyKwh(false)}
              disabled={isSavingKwh}
              className="inline-flex h-11 min-w-[88px] items-center justify-center gap-2 rounded-xl border border-mint/30 bg-mint/10 px-4 text-sm font-bold text-mint transition-colors hover:bg-mint/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingKwh ? <LoadingIndicator size="sm" label="Saving" showLabel={false} /> : "Save"}
            </button>
          </div>
          <p className={`mt-3 text-xs leading-relaxed ${kwhError ? "text-danger" : "text-white/50"}`}>
            {kwhError
              ? kwhError
              : draftKwh !== null
                ? `Meralco charges a home using ${draftKwh.toLocaleString("en-PH")} kWh a month the ${distributionTierLabel(draftKwh)} distribution rate on every kWh.`
                : "Meralco's distribution rate depends on your whole home's monthly kWh. Leave this empty and WattWise estimates it from your monitored appliances."}
          </p>
          {meralcoMonthlyKwh !== null ? (
            <button
              type="button"
              onClick={() => void saveMonthlyKwh(true)}
              disabled={isSavingKwh}
              className="mt-2 min-h-10 text-xs font-semibold text-white/60 underline hover:text-white disabled:opacity-60"
            >
              Clear and use monitored usage
            </button>
          ) : null}
        </div>
      </section>
  );
}
