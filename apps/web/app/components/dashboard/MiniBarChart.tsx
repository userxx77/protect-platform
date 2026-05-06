'use client';

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export function MiniBarChart({
  data,
  dataKey,
  xKey,
  height = 160,
}: {
  data: Record<string, unknown>[];
  dataKey: string;
  xKey: string;
  height?: number;
}) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 6, right: 6, left: -24, bottom: 0 }}>
          <CartesianGrid stroke="oklch(0.3 0.018 265)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 10, fill: 'oklch(0.68 0.015 270)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'oklch(0.68 0.015 270)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'oklch(0.205 0.018 265)',
              border: '1px solid oklch(0.3 0.018 265)',
              borderRadius: 8,
              fontSize: 12,
            }}
            cursor={{ fill: 'oklch(0.55 0.25 295 / 0.1)' }}
          />
          <Bar dataKey={dataKey} fill="oklch(0.6 0.22 295)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
