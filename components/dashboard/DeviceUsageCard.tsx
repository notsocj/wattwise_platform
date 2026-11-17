"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CARD, CardHeader } from "@/components/ui/Card";
import { Activity } from "@/components/ui/icons";

export type UsageAmount = { kwh: number; php: number };
export type UsagePeriod = UsageAmount & { label: string; hint: string };
export type UsageDay = UsageAmount & { key: string; label: string; isToday: boolean };

type Unit = "php" | "kwh";

const UNITS = [
  { value: "php", label: "Pesos" },
  { value: "kwh", label: "kWh" },
] as const;

function formatKwh(kwh: number) {
  const digits = kwh === 0 ? 0 : kwh < 0.1 ? 3 : kwh < 10 ? 2 : 1;
  return `${kwh.toFixed(digits)} kWh`;
}

function formatPhp(php: number) {
  if (php > 0 && php < 0.01) return "< ₱0.01";
  return `₱${php.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const format = (unit: Unit, amount: UsageAmount) =>
  unit === "php" ? formatPhp(amount.php) : formatKwh(amount.kwh);

export default function DeviceUsageCard({
  cycle,
  cycleStartLabel,
  periods,
  days,
}: {
  cycle: UsageAmount;
  cycleStartLabel: string;
  periods: UsagePeriod[];
  days: UsageDay[];
}) {
  const [unit, setUnit] = useState<Unit>("php");
  const activeIndex = UNITS.findIndex((option) => option.value === unit);
  const average: UsageAmount = {
    kwh: cycle.kwh / Math.max(days.length, 1),
    php: cycle.php / Math.max(days.length, 1),
  };
  const highest = days.reduce<UsageDay | null>((top, day) => (day.kwh > (top?.kwh ?? 0) ? day : top), null);

  return (
    <section className={`${CARD} p-5 lg:p-6`}>
      <CardHeader
        icon={Activity}
        title="Energy use"
        aside={
          <div role="radiogroup" aria-label="Show amounts in" className="relative grid grid-cols-2 rounded-full bg-fg/[0.06] p-1">
            {/* One highlight that slides between options (state change, 200ms strong ease-in-out). */}
            <span
              aria-hidden="true"
              className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-surface shadow-sm ring-1 ring-fg/[0.06] transition-[translate] duration-200 ease-in-out"
              style={{ translate: `${activeIndex * 100}% 0` }}
            />
            {UNITS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={unit === value}
                onClick={() => setUnit(value)}
                className={`relative z-10 inline-flex h-8 min-w-14 items-center justify-center rounded-full px-3 text-xs font-semibold transition-[color,scale] duration-150 ease-out active:scale-[0.96] ${
                  unit === value ? "text-fg" : "text-fg/50 hover:text-fg/80"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      {/* Billing cycle: the number that lines up with the Meralco bill. */}
      <div className="mt-5">
        <p className="text-xs font-medium text-fg/55">This billing cycle · since {cycleStartLabel}</p>
        <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-fg">{format(unit, cycle)}</p>
        <p className="mt-1 text-xs text-fg/55">
          {unit === "php" ? formatKwh(cycle.kwh) : formatPhp(cycle.php)} · about {format(unit, average)} a day
        </p>
      </div>

      {/* Day by day */}
      <div className="mt-5">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-fg/80">Day by day</p>
          {highest ? (
            <p className="truncate text-xs text-fg/55">
              Highest: {highest.label}, {format(unit, highest)}
            </p>
          ) : null}
        </div>
        <div
          role="img"
          aria-label={`Daily ${unit === "php" ? "cost" : "energy use"} this billing cycle. ${days
            .map((day) => `${day.label}: ${format(unit, day)}`)
            .join(", ")}`}
        >
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={days} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={16}
                tick={{ fontSize: 10, fill: "var(--chart-axis)" }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={52}
                tick={{ fontSize: 10, fill: "var(--chart-axis)" }}
                tickFormatter={(value: number) => (unit === "php" ? `₱${value}` : `${value}`)}
              />
              <Tooltip
                cursor={{ fill: "var(--chart-grid)" }}
                contentStyle={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--chart-track)",
                  borderRadius: 12,
                  color: "var(--color-text)",
                  fontSize: 12,
                }}
                itemStyle={{ color: "var(--color-text)" }}
                formatter={(_value, _name, item) => {
                  const day = item.payload as UsageDay;
                  return [`${formatPhp(day.php)} · ${formatKwh(day.kwh)}`, day.isToday ? "Today so far" : "Used"];
                }}
              />
              <Bar dataKey={unit} radius={[6, 6, 2, 2]} maxBarSize={22} isAnimationActive={false}>
                {days.map((day) => (
                  <Cell key={day.key} fill="var(--color-mint)" fillOpacity={day.isToday ? 1 : 0.45} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent periods */}
      <div className="mt-5 grid grid-cols-2 gap-2">
        {periods.map((period) => (
          <div key={period.label} className="rounded-xl border border-fg/[0.05] bg-fg/[0.02] px-3 py-3">
            <p className="text-xs font-medium text-fg/55">{period.label}</p>
            <p className="mt-1 whitespace-nowrap text-base font-bold tabular-nums text-fg">{format(unit, period)}</p>
            <p className="mt-0.5 text-[11px] text-fg/50">{period.hint}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-fg/50">
        kWh (kilowatt-hour) is the unit on your Meralco bill. Peso amounts are this appliance&apos;s
        Meralco energy charges; the bill&apos;s fixed fees are in Billing cycle below.
      </p>
    </section>
  );
}
