import {
  Calculator,
  DollarSign,
  History,
  Percent,
  Save,
  Zap,
} from "lucide-react";
import {
  AdminMetricCard,
  AdminPageHeader,
  AdminSection,
  AdminStatusBadge,
  AdminTable,
} from "@/components/admin";

const rateComponents = [
  {
    label: "Generation",
    name: "generation",
    value: "7.3821",
    helper: "Power supply charge per kWh",
  },
  {
    label: "Transmission",
    name: "transmission",
    value: "0.7392",
    helper: "Grid transmission charge per kWh",
  },
  {
    label: "System Loss",
    name: "system_loss",
    value: "0.6128",
    helper: "Recoverable system loss charge",
  },
  {
    label: "Distribution",
    name: "distribution",
    value: "1.8354",
    helper: "Distribution network charge",
  },
  {
    label: "Universal Charges",
    name: "universal_charges",
    value: "0.3971",
    helper: "Universal and missionary charges",
  },
  {
    label: "FIT-All",
    name: "fit_all",
    value: "0.0838",
    helper: "Feed-in tariff allowance",
  },
];

const fixedCharges = [
  {
    label: "Supply Charge",
    name: "supply_charge",
    value: "25.00",
  },
  {
    label: "Metering Charge",
    name: "metering_charge",
    value: "5.00",
  },
];

const historyColumns = [
  { key: "month", header: "Effective Month" },
  { key: "baseRate", header: "Base Rate", align: "right" as const },
  { key: "vat", header: "VAT", align: "right" as const },
  { key: "total", header: "Total / kWh", align: "right" as const },
  { key: "status", header: "Status" },
];

const historyRows = [
  {
    month: "March 2026",
    baseRate: "₱11.0504",
    vat: "12%",
    total: "₱12.3764",
    status: <AdminStatusBadge tone="success">Active</AdminStatusBadge>,
  },
  {
    month: "February 2026",
    baseRate: "₱10.8849",
    vat: "12%",
    total: "₱12.1911",
    status: <AdminStatusBadge tone="neutral">Archived</AdminStatusBadge>,
  },
  {
    month: "January 2026",
    baseRate: "₱10.4217",
    vat: "12%",
    total: "₱11.6723",
    status: <AdminStatusBadge tone="neutral">Archived</AdminStatusBadge>,
  },
];

function RateInput({
  label,
  name,
  value,
  helper,
}: {
  label: string;
  name: string;
  value: string;
  helper?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
        {label}
      </span>
      <div className="mt-2 flex rounded-lg border border-white/10 bg-white/[0.03] focus-within:border-mint/40">
        <span className="flex items-center border-r border-white/10 px-3 text-sm font-semibold text-white/40">
          ₱
        </span>
        <input
          name={name}
          defaultValue={value}
          inputMode="decimal"
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm font-semibold text-white outline-none placeholder:text-white/30"
          aria-label={label}
        />
      </div>
      {helper ? (
        <span className="mt-1.5 block text-xs leading-5 text-white/40">
          {helper}
        </span>
      ) : null}
    </label>
  );
}

export default function AdminRatesPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={DollarSign}
        title="Meralco Rate Editor"
        description="Frontend preview for managing the unbundled Meralco billing components used across WattWise cost calculations."
        actions={<AdminStatusBadge tone="warning">Frontend Only</AdminStatusBadge>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Active Month"
          value="March 2026"
          helper="Current mock rate period"
          trend="Active"
          icon={History}
          tone="success"
        />
        <AdminMetricCard
          label="Base Rate"
          value="₱11.0504"
          helper="Per-kWh subtotal before VAT"
          trend="Mock"
          icon={Calculator}
          tone="default"
        />
        <AdminMetricCard
          label="VAT"
          value="12%"
          helper="Applied after per-kWh subtotal"
          trend="+₱1.3260"
          icon={Percent}
          tone="warning"
        />
        <AdminMetricCard
          label="Total Rate"
          value="₱12.3764"
          helper="Estimated all-in rate per kWh"
          trend="Preview"
          icon={Zap}
          tone="success"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <AdminSection
          title="Rate Components"
          description="Mock form layout for the monthly residential billing components. Backend save logic comes later."
          actions={
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white/40 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              Save Disabled
            </button>
          }
        >
          <form className="space-y-6">
            <div>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  Effective Month
                </span>
                <input
                  type="month"
                  defaultValue="2026-03"
                  className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-mint/40"
                  aria-label="Effective month"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {rateComponents.map((component) => (
                <RateInput key={component.name} {...component} />
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {fixedCharges.map((charge) => (
                <RateInput key={charge.name} {...charge} />
              ))}
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  VAT Rate
                </span>
                <div className="mt-2 flex rounded-lg border border-white/10 bg-white/[0.03] focus-within:border-mint/40">
                  <input
                    name="vat_rate"
                    defaultValue="12"
                    inputMode="decimal"
                    className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm font-semibold text-white outline-none placeholder:text-white/30"
                    aria-label="VAT rate"
                  />
                  <span className="flex items-center border-l border-white/10 px-3 text-sm font-semibold text-white/40">
                    %
                  </span>
                </div>
                <span className="mt-1.5 block text-xs leading-5 text-white/40">
                  Percentage applied after unbundled subtotal.
                </span>
              </label>
            </div>
          </form>
        </AdminSection>

        <AdminSection
          title="Live Preview"
          description="Static calculation preview for the future editor workflow."
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                Per-kWh subtotal
              </p>
              <p className="mt-2 text-3xl font-bold text-white">₱11.0504</p>
              <p className="mt-2 text-sm leading-6 text-white/50">
                Sum of generation, transmission, system loss, distribution,
                universal charges, and FIT-All.
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                VAT amount
              </p>
              <p className="mt-2 text-3xl font-bold text-white">₱1.3260</p>
              <p className="mt-2 text-sm leading-6 text-white/50">
                12% VAT preview based on the current mock subtotal.
              </p>
            </div>

            <div className="rounded-lg border border-mint/25 bg-mint/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-mint/70">
                Total rate preview
              </p>
              <p className="mt-2 text-3xl font-bold text-mint">₱12.3764</p>
              <p className="mt-2 text-sm leading-6 text-white/60">
                This value will drive user-facing cost calculations after
                backend wiring.
              </p>
            </div>
          </div>
        </AdminSection>
      </div>

      <AdminSection
        title="Rate History"
        description="Mock history table for previously active Meralco rate entries."
      >
        <AdminTable columns={historyColumns} rows={historyRows} />
      </AdminSection>
    </div>
  );
}
