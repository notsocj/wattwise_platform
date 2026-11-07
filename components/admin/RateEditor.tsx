"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, PencilLine, Plus, X } from "@/components/ui/icons";
import { RATE_FIELD_GROUPS, RATE_FIELDS } from "@/lib/meralco-rate-input";
import {
  computeFixedChargesWithVat,
  computeVariableRatePerKwh,
  mapMeralcoRatesRowToComponents,
  type MeralcoRatesRow,
} from "@/lib/meralco-rates";

type FormValues = Record<string, string>;

/** Form strings from a row; VAT shown as percent. */
function toForm(row: MeralcoRatesRow | null): FormValues {
  const values: FormValues = {};
  for (const field of RATE_FIELDS) {
    const raw = row ? (row as unknown as Record<string, number | string | null>)[field.key] : null;
    if (raw === null || raw === undefined) {
      values[field.key] = "";
    } else {
      const number = Number(raw);
      values[field.key] = field.kind === "vat" ? String(Number((number * 100).toFixed(4))) : String(number);
    }
  }
  return values;
}

/** Database values from form strings; VAT back to a fraction. Blank stays blank. */
function toPayload(values: FormValues) {
  const payload: Record<string, number | string | null> = {};
  for (const field of RATE_FIELDS) {
    const text = values[field.key]?.trim() ?? "";
    if (!text) {
      payload[field.key] = field.optional ? null : "";
    } else {
      const number = Number(text);
      payload[field.key] = field.kind === "vat" && Number.isFinite(number) ? number / 100 : text;
    }
  }
  return payload;
}

function previewRate(values: FormValues): { perKwh: number; fixed: number } | null {
  const payload = toPayload(values);
  if (RATE_FIELDS.some((field) => !field.optional && (payload[field.key] === "" || !Number.isFinite(Number(payload[field.key]))))) {
    return null;
  }
  const row = { ...payload, effective_month: "", created_at: "", source_url: null, source_pdf_url: null, fetched_at: null, auto_updated: false } as unknown as MeralcoRatesRow;
  const vat = Number(payload.vat_rate);
  const components = mapMeralcoRatesRowToComponents(row);
  return {
    perKwh: computeVariableRatePerKwh(components, vat),
    fixed: computeFixedChargesWithVat(Number(payload.metering_charge) + Number(payload.supply_charge), vat),
  };
}

function nextMonthKey(latest: string | undefined): string {
  if (!latest) return new Date().toISOString().slice(0, 7);
  const [year, month] = latest.slice(0, 7).split("-").map(Number);
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
}

export default function RateEditor({ rows }: { rows: MeralcoRatesRow[] }) {
  const router = useRouter();
  const latest = rows[0] ?? null;
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(nextMonthKey(latest?.effective_month));
  const [values, setValues] = useState<FormValues>(() => toForm(latest));
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const existing = rows.find((row) => row.effective_month.slice(0, 7) === month);
  const preview = previewRate(values);

  function startNew() {
    setMonth(nextMonthKey(latest?.effective_month));
    setValues(toForm(latest));
    setErrors({});
    setMessage(null);
    setOpen(true);
  }

  function startEdit(row: MeralcoRatesRow) {
    setMonth(row.effective_month.slice(0, 7));
    setValues(toForm(row));
    setErrors({});
    setMessage(null);
    setOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    setErrors({});
    try {
      const response = await fetch("/api/admin/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...toPayload(values), effective_month: month, reason }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string; fields?: Record<string, string>; created?: boolean };
      if (!response.ok) {
        if (body.fields) setErrors(body.fields);
        setMessage({ tone: "error", text: body.error ?? "Could not save these rates." });
        return;
      }
      setMessage({ tone: "success", text: `${body.created ? "Added" : "Updated"} rates for ${month}. Bills now use them.` });
      setReason("");
      setOpen(false);
      router.refresh();
    } catch {
      setMessage({ tone: "error", text: "Couldn't reach WattWise. Check your connection and try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {message && !open ? (
        <p
          role="status"
          className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-[opacity,translate] duration-200 ease-out starting:-translate-y-1 starting:opacity-0 ${
            message.tone === "success" ? "border-mint/30 bg-mint/10 text-accent" : "border-danger/30 bg-danger/10 text-danger"
          }`}
        >
          {message.tone === "success" ? <Check className="h-4 w-4" aria-hidden="true" /> : <AlertCircle className="h-4 w-4" aria-hidden="true" />}
          {message.text}
        </p>
      ) : null}

      {open ? (
        <section className="rounded-2xl border border-mint/25 bg-surface p-5 transition-[opacity,translate] duration-200 ease-out starting:-translate-y-1 starting:opacity-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold tracking-tight">{existing ? "Correct a month" : "Add a month"}</h2>
              <p className="mt-0.5 text-xs text-fg/45">
                Saved as a manual entry. The monthly sync replaces it if Meralco later publishes this month.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close the rate editor"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-fg/10 text-fg/60 transition-colors hover:text-fg"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
            className="mt-5 space-y-6"
          >
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-fg/60">Effective month</span>
                <input
                  type="month"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  required
                  className="h-11 w-full rounded-full border border-fg/10 bg-shade/10 px-4 text-sm text-fg outline-none focus:border-mint/40"
                />
                {errors.effective_month ? <span className="mt-1 block text-xs text-danger">{errors.effective_month}</span> : null}
                {existing ? <span className="mt-1 block text-xs text-naku">This month exists and will be replaced.</span> : null}
              </label>
              <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-mint/[0.06] px-4 py-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg/45">Preview, incl. VAT</p>
                  <p className="mt-0.5 text-2xl font-semibold tabular-nums text-accent">
                    {preview ? `₱${preview.perKwh.toFixed(4)}` : "—"}
                    <span className="ml-1 text-sm font-normal text-fg/50">per kWh</span>
                  </p>
                </div>
                <p className="pb-1 text-xs text-fg/50">
                  {preview ? `+ ₱${preview.fixed.toFixed(2)} fixed per month (up to 200 kWh tier)` : "Fill every required field to see the rate."}
                </p>
              </div>
            </div>

            {RATE_FIELD_GROUPS.map((group) => (
              <fieldset key={group.title}>
                <legend className="text-sm font-semibold">{group.title}</legend>
                <p className="mt-0.5 text-xs text-fg/45">{group.hint}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {group.fields.map((field) => (
                    <label key={field.key} className="block">
                      <span className="mb-1 block text-xs text-fg/60">
                        {field.label}
                        {field.optional ? <span className="text-fg/35"> · optional</span> : null}
                      </span>
                      <div className="relative">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          value={values[field.key] ?? ""}
                          onChange={(event) => {
                            const next = event.target.value;
                            setValues((current) => ({ ...current, [field.key]: next }));
                            setErrors((current) => ({ ...current, [field.key]: "" }));
                          }}
                          required={!field.optional}
                          aria-invalid={Boolean(errors[field.key])}
                          className={`h-11 w-full rounded-full border bg-shade/10 pl-4 pr-12 text-sm tabular-nums text-fg outline-none transition-colors focus:border-mint/40 ${
                            errors[field.key] ? "border-danger/60" : "border-fg/10"
                          }`}
                        />
                        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-fg/35">
                          {field.kind === "vat" ? "%" : field.kind === "fixed" ? "₱/mo" : "₱/kWh"}
                        </span>
                      </div>
                      {errors[field.key] ? <span className="mt-1 block text-xs text-danger">{errors[field.key]}</span> : null}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-fg/60">Reason (saved in the audit log)</span>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={300}
                placeholder="e.g. Sync failed; entered from Meralco's November rate PDF"
                className={`h-11 w-full rounded-full border bg-shade/10 px-4 text-sm text-fg outline-none placeholder:text-fg/30 focus:border-mint/40 ${
                  errors.reason ? "border-danger/60" : "border-fg/10"
                }`}
              />
              {errors.reason ? <span className="mt-1 block text-xs text-danger">{errors.reason}</span> : null}
            </label>

            {message?.tone === "error" ? (
              <p role="alert" className="flex items-center gap-2 text-sm font-semibold text-danger">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                {message.text}
              </p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-11 rounded-full border border-fg/10 px-5 text-sm font-semibold text-fg/70 transition-colors hover:text-fg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-mint px-6 text-sm font-bold text-ink transition-[opacity,scale] duration-150 ease-out enabled:active:scale-[0.97] disabled:opacity-60"
              >
                {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/25 border-t-ink" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
                {saving ? "Saving..." : existing ? "Replace rates" : "Save rates"}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <button
          type="button"
          onClick={startNew}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-mint px-5 text-sm font-bold text-ink transition-[scale] duration-150 ease-out active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add or correct a month
        </button>
      )}

      <RateHistoryTable rows={rows} onEdit={startEdit} />
    </div>
  );
}

function RateHistoryTable({ rows, onEdit }: { rows: MeralcoRatesRow[]; onEdit: (row: MeralcoRatesRow) => void }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-fg/[0.06] bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-fg/[0.06] text-xs uppercase tracking-[0.1em] text-fg/45">
          <tr>
            {["Month", "Source", "Generation", "Distribution", "Adjustments", "VAT", "Fixed", "₱/kWh incl. VAT", ""].map((heading) => (
              <th key={heading} className="whitespace-nowrap px-4 py-3 font-semibold">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const components = mapMeralcoRatesRowToComponents(row);
            const adjustments =
              components.awatAdjustment +
              components.regulatoryResetAdjustment +
              components.lifelineRateAdjustment +
              components.seniorCitizenSubsidy +
              components.rptCharge +
              components.geaAll +
              components.lifelineSubsidy;
            return (
              <tr key={row.effective_month} className="border-b border-fg/[0.04] last:border-0">
                <td className="whitespace-nowrap px-4 py-3 font-semibold">{row.effective_month.slice(0, 7)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      row.auto_updated ? "bg-mint/10 text-accent" : "bg-naku/10 text-naku"
                    }`}
                  >
                    {row.auto_updated ? "Synced" : "Manual"}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums">₱{Number(row.generation).toFixed(4)}</td>
                <td className="px-4 py-3 tabular-nums">₱{Number(row.distribution).toFixed(4)}</td>
                <td className="px-4 py-3 tabular-nums">₱{adjustments.toFixed(4)}</td>
                <td className="px-4 py-3 tabular-nums">{(Number(row.vat_rate) * 100).toFixed(2)}%</td>
                <td className="px-4 py-3 tabular-nums">₱{(Number(row.metering_charge) + Number(row.supply_charge)).toFixed(2)}</td>
                <td className="px-4 py-3 font-semibold tabular-nums">₱{computeVariableRatePerKwh(components, Number(row.vat_rate)).toFixed(4)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onEdit(row)}
                    aria-label={`Correct rates for ${row.effective_month.slice(0, 7)}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-fg/10 px-3 text-xs font-semibold text-fg/70 transition-colors hover:border-mint/30 hover:text-accent"
                  >
                    <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
                    Edit
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
