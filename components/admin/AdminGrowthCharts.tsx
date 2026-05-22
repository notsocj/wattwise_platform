"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type GrowthPoint = {
  day: string;
  users: number;
  devices: number;
};

export type AdoptionPoint = {
  type: string;
  devices: number;
};

interface UserGrowthChartProps {
  data: GrowthPoint[];
}

interface DeviceAdoptionChartProps {
  data: AdoptionPoint[];
}

const tooltipStyle = {
  background: "var(--color-surface)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "8px",
  color: "var(--color-text)",
};

export function UserGrowthChart({ data }: UserGrowthChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
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
        <Line
          type="monotone"
          dataKey="users"
          name="Users"
          stroke="#00E66F"
          strokeWidth={3}
          dot={false}
          activeDot={{ r: 5, fill: "#00E66F", strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="devices"
          name="Devices"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "rgba(255,255,255,0.75)", strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DeviceAdoptionChart({ data }: DeviceAdoptionChartProps) {
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
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(0,230,111,0.06)" }} />
        <Bar
          dataKey="devices"
          name="Devices"
          fill="#00E66F"
          radius={[6, 6, 0, 0]}
          maxBarSize={44}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
