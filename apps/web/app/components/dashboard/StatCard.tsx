import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';

export function StatCard({
  label,
  value,
  icon,
  trend,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
}) {
  return (
    <Card className="flex items-center gap-4">
      <div className="bg-primary-soft text-primary grid h-11 w-11 place-items-center rounded-lg">
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-muted-foreground text-xs">{label}</div>
        <div className="mt-0.5 text-2xl font-semibold tracking-tight">{value}</div>
        {trend ? (
          <div className="mt-0.5 text-[11px] text-[oklch(0.85_0.18_155)]">{trend}</div>
        ) : null}
      </div>
    </Card>
  );
}
