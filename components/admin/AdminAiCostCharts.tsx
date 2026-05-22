"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type AiTokenUsagePoint = {
  day: string;
  prompt: number;
  completion: number;
};

export type AiInsightBreakdownPoint = {
  type: string;
  count: number;
  color: string;
};

interface TokenUsageChartProps {
  data: AiTokenUsagePoint[];
}

interface InsightBreakdownChartProps {
  data: AiInsightBreakdownPoint[];
}

const tooltipStyle = {
  background: "var(--color-surface)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "8px",
  color: "var(--color-text)",
};

export function TokenUsageChart({ data }: TokenUsageChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
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
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(0,230,111,0.06)" }} />
        <Bar
          dataKey="prompt"
          name="Prompt tokens"
          stackId="tokens"
          fill="rgba(255,255,255,0.42)"
          radius={[0, 0, 4, 4]}
          maxBarSize={42}
        />
        <Bar
          dataKey="completion"
          name="Completion tokens"
          stackId="tokens"
          fill="#00E66F"
          radius={[6, 6, 0, 0]}
          maxBarSize={42}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function InsightBreakdownChart({ data }: InsightBreakdownChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 8, left: 36, bottom: 0 }}
      >
        <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
        <XAxis
          type="number"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
        />
        <YAxis
          dataKey="type"
          type="category"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
          width={86}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="count" name="Insights" radius={[0, 6, 6, 0]} maxBarSize={22}>
          {data.map((point) => (
            <Cell key={point.type} fill={point.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
