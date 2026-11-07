"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ReceiptText } from "@/components/ui/icons";
import { SettingsGroup, SettingsRow } from "@/components/settings/SettingsGroup";
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

  const billingDirty = billingCycleDraft !== String(billingCycleStartDay);
  const kwhSaved = meralcoMonthlyKwh === null ? "" : String(meralcoMonthlyKwh);
  const kwhDirty = kwhDraft.trim() !== kwhSaved;

  return (
    <SettingsGroup
      title="Billing"
      footer="WattWise uses these for wallet totals, forecasts, and Smart Control cutoffs."
    >
      <SettingsRow
        icon={CalendarDays}
        title="Billing cycle starts on"
        description={billingCycleError ?? "The day Meralco reads your meter (1 to 28)."}
        control={
          <div className="flex items-center gap-2">
            <label htmlFor="billing-cycle-start-day" className="sr-only">
              Billing cycle start day
            </label>
            <select
              id="billing-cycle-start-day"
              value={billingCycleDraft}
              disabled={isSavingBillingCycle}
              onChange={(event) => {
                setBillingCycleDraft(event.target.value);
                if (billingCycleError) setBillingCycleError(null);
              }}
              className="h-9 rounded-full border border-fg/10 bg-shade/10 pl-3.5 pr-2 text-sm font-semibold text-fg outline-none transition-colors focus:border-mint/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
                <option key={day} value={String(day)} className="bg-surface text-fg">
                  Day {day}
                </option>
              ))}
            </select>
            {billingDirty || isSavingBillingCycle ? (
              <SaveButton saving={isSavingBillingCycle} onClick={() => void saveBillingCycle()} />
            ) : null}
          </div>
        }
      />

      <SettingsRow
        icon={ReceiptText}
        title="kWh on your Meralco bill"
        description={
          kwhError ??
          (draftKwh !== null
            ? `At ${draftKwh.toLocaleString("en-PH")} kWh a month, Meralco charges the ${distributionTierLabel(draftKwh)} distribution rate.`
            : "Optional. Leave empty and WattWise estimates it from your appliances.")
        }
      >
        <div className="flex items-center gap-2">
          <label htmlFor="meralco-monthly-kwh" className="sr-only">
            Monthly kWh on your Meralco bill
          </label>
          <div className="relative min-w-0 flex-1">
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
              className={`h-10 w-full rounded-full border bg-shade/10 pl-4 pr-12 text-base font-semibold text-fg outline-none transition-colors placeholder:font-normal placeholder:text-fg/30 focus:border-mint/40 disabled:cursor-not-allowed disabled:opacity-60 ${
                kwhError ? "border-danger/50" : "border-fg/10"
              }`}
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-fg/40">kWh</span>
          </div>
          {kwhDirty || isSavingKwh ? <SaveButton saving={isSavingKwh} onClick={() => void saveMonthlyKwh(false)} /> : null}
        </div>
        {meralcoMonthlyKwh !== null && !kwhDirty ? (
          <button
            type="button"
            onClick={() => void saveMonthlyKwh(true)}
            disabled={isSavingKwh}
            className="mt-2 min-h-9 text-xs font-semibold text-fg/55 underline-offset-2 transition-colors hover:text-fg hover:underline disabled:opacity-60"
          >
            Clear and use monitored usage
          </button>
        ) : null}
      </SettingsRow>
    </SettingsGroup>
  );
}

/** Appears only when a value changed; eases in so it reads as "you have unsaved changes". */
function SaveButton({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className="inline-flex h-9 min-w-16 items-center justify-center rounded-full bg-mint px-3.5 text-sm font-bold text-ink transition-[opacity,scale,translate] duration-200 ease-out enabled:active:scale-[0.96] disabled:opacity-70 starting:translate-x-1 starting:opacity-0"
    >
      {saving ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink/25 border-t-ink" aria-label="Saving" /> : "Save"}
    </button>
  );
}
