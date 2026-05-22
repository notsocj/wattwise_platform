"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type PlatformEnergyPoint = {
  day: string;
  kwh: number;
  cost: number;
};

export type ApplianceMixPoint = {
  type: string;
  kwh: number;
  color: string;
};

interface PlatformEnergyChartProps {
  data: PlatformEnergyPoint[];
}

interface ApplianceMixChartProps {
  data: ApplianceMixPoint[];
}

const tooltipStyle = {
  background: "var(--color-surface)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "8px",
  color: "var(--color-text)",
};

export function PlatformEnergyChart({ data }: PlatformEnergyChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="platformEnergy" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00E66F" stopOpacity={0.32} />
            <stop offset="95%" stopColor="#00E66F" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis
          dataKey="day"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "#00E66F33" }} />
        <Area
          type="monotone"
          dataKey="kwh"
          name="kWh monitored"
          stroke="#00E66F"
          strokeWidth={3}
          fill="url(#platformEnergy)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ApplianceMixChart({ data }: ApplianceMixChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis
          dataKey="type"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="kwh" name="kWh" radius={[6, 6, 0, 0]} maxBarSize={48}>
          {data.map((point) => (
            <Cell key={point.type} fill={point.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
