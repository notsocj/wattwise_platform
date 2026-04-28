"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { WeeklyUsageChartProps } from "@/components/insights/WeeklyUsageChart.types";

export default function WeeklyUsageChart({ data }: WeeklyUsageChartProps) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} barGap={2} barCategoryGap="20%">
        <XAxis
          dataKey="day"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
        />
        <YAxis hide />
        <Bar dataKey="thisWk" radius={[4, 4, 0, 0]} maxBarSize={16}>
          {data.map((point) => (
            <Cell key={`this-${point.day}`} fill="#00E66F" />
          ))}
        </Bar>
        <Bar dataKey="lastWk" radius={[4, 4, 0, 0]} maxBarSize={16}>
          {data.map((point) => (
            <Cell key={`last-${point.day}`} fill="rgba(255,255,255,0.12)" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
