import Link from 'next/link';
import { cn } from '@/lib/utils';

const RANGES = ['24h', '7d', '30d'] as const;

export function RangeToggle({ range }: { range: (typeof RANGES)[number] }) {
  return (
    <div className="border-border bg-surface/50 inline-flex items-center gap-1 rounded-lg border p-1">
      {RANGES.map((r) => (
        <Link
          key={r}
          href={`/dashboard/analytics?range=${r}`}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium transition-colors',
            range === r ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {r}
        </Link>
      ))}
    </div>
  );
}
