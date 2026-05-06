import { cn } from '@/lib/utils';

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initial = name.replace(/^@/, '').charAt(0).toUpperCase();
  return (
    <div
      className={cn(
        'text-primary-foreground grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold',
        'bg-gradient-to-br from-primary to-[oklch(0.4_0.2_295)] ring-border/60 ring-1',
        className,
      )}
    >
      {initial}
    </div>
  );
}
