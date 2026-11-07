"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type AdminChartPoint = { label: string; value: number; secondary?: number };

type AdminChartProps = {
  data: AdminChartPoint[];
  kind: "bar" | "area";
  /** Tooltip name for `value` (and `secondary`, drawn as a second, muted series). */
  valueLabel: string;
  secondaryLabel?: string;
  format?: "number" | "kwh" | "usd";
  height?: number;
};

function formatValue(value: number, format: AdminChartProps["format"]) {
  if (format === "usd") return `$${value.toFixed(value < 1 ? 4 : 2)}`;
  if (format === "kwh") return `${value.toFixed(2)} kWh`;
  return value.toLocaleString();
}

const TOOLTIP_STYLE = {
  background: "var(--color-surface)",
  border: "1px solid var(--chart-track)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--color-fg)",
};

/** Bar or area chart for the admin console, themed with the chart tokens. */
export default function AdminChart({ data, kind, valueLabel, secondaryLabel, format = "number", height = 220 }: AdminChartProps) {
  const axis = { fontSize: 10, fill: "var(--chart-axis)" };
  const tooltip = (
    <Tooltip
      cursor={{ fill: "var(--chart-track)", opacity: 0.4 }}
      contentStyle={TOOLTIP_STYLE}
      formatter={(value, name) => [formatValue(Number(value), format), name]}
    />
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      {kind === "bar" ? (
        <BarChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
          <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={format !== "number"} width={44} />
          {tooltip}
          <Bar dataKey="value" name={valueLabel} fill="var(--color-mint)" radius={[6, 6, 0, 0]} maxBarSize={28} />
          {secondaryLabel ? (
            <Bar dataKey="secondary" name={secondaryLabel} fill="var(--chart-muted-bar)" radius={[6, 6, 0, 0]} maxBarSize={28} />
          ) : null}
        </BarChart>
      ) : (
        <AreaChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="adminChartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-mint)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--color-mint)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
          <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={format !== "number"} width={44} />
          {tooltip}
          <Area type="monotone" dataKey="value" name={valueLabel} stroke="var(--color-mint)" strokeWidth={2} fill="url(#adminChartFill)" />
          {secondaryLabel ? (
            <Area type="monotone" dataKey="secondary" name={secondaryLabel} stroke="var(--chart-axis)" strokeWidth={1.5} fill="transparent" />
          ) : null}
        </AreaChart>
      )}
    </ResponsiveContainer>
  );
}
