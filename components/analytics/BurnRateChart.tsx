"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type BurnRatePoint = {
  day: string;
  cost: number;
  kwh: number;
};

export default function BurnRateChart({ data }: { data: BurnRatePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <AreaChart data={data} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="burnRateFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00E66F" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#00E66F" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis
          dataKey="day"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: "var(--chart-axis)" }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: "var(--chart-axis)" }}
          tickFormatter={(value) => `₱${value}`}
        />
        <Tooltip
          cursor={{ stroke: "rgba(0,230,111,0.35)" }}
          contentStyle={{
            background: "var(--color-surface)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            color: "var(--color-text)",
          }}
          formatter={(value, name) => [
            name === "cost" ? `₱${Number(value).toFixed(2)}` : `${Number(value).toFixed(2)} kWh`,
            name === "cost" ? "Cost" : "Usage",
          ]}
        />
        <Area
          type="monotone"
          dataKey="cost"
          stroke="#00E66F"
          strokeWidth={2}
          fill="url(#burnRateFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
