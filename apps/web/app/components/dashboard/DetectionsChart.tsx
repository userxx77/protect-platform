'use client';

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

export function DetectionsChart({
  data,
  dataKey = 'detections',
  xKey = 'hour',
  height = 240,
}: {
  data: Record<string, unknown>[];
  dataKey?: string;
  xKey?: string;
  height?: number;
}) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradProtect" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.55 0.25 295)" stopOpacity={0.55} />
              <stop offset="100%" stopColor="oklch(0.55 0.25 295)" stopOpacity={0} />
            </linearGradient>
          </defs>
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
            labelStyle={{ color: 'oklch(0.97 0.005 270)' }}
            cursor={{ stroke: 'oklch(0.55 0.25 295)', strokeOpacity: 0.4 }}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke="oklch(0.7 0.22 295)"
            strokeWidth={2}
            fill="url(#gradProtect)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
