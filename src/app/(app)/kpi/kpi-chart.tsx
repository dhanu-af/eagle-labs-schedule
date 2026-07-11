"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

export default function KpiChart({
  data,
  unit,
  color,
}: {
  data: { day: string; actual: number; target: number; isToday: boolean }[];
  unit: string;
  color: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
        <XAxis
          dataKey="day"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
        />
        <Tooltip
          cursor={{ fill: "var(--surface-muted)" }}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            fontSize: 12,
            color: "var(--foreground)",
          }}
          formatter={(value, name) => [`${value} ${unit}`, name === "target" ? "Target" : "Actual"]}
        />
        <Bar dataKey="actual" radius={[6, 6, 2, 2]} maxBarSize={28}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.isToday ? color : `color-mix(in srgb, ${color} 55%, transparent)`} />
          ))}
        </Bar>
        <Line
          type="stepAfter"
          dataKey="target"
          stroke="var(--muted-foreground)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
          activeDot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
