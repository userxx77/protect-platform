import * as React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'success' | 'warning' | 'destructive' | 'muted' | 'primary';

const styles: Record<Variant, string> = {
  default: 'bg-surface-2 text-foreground border-border',
  primary: 'bg-primary-soft text-primary border-primary/30',
  success: 'bg-[oklch(0.7_0.18_155/0.15)] text-[oklch(0.85_0.18_155)] border-[oklch(0.7_0.18_155/0.35)]',
  warning: 'bg-[oklch(0.78_0.16_75/0.15)] text-[oklch(0.88_0.16_75)] border-[oklch(0.78_0.16_75/0.35)]',
  destructive:
    'bg-[oklch(0.62_0.22_25/0.15)] text-[oklch(0.82_0.22_25)] border-[oklch(0.62_0.22_25/0.35)]',
  muted: 'bg-surface text-muted-foreground border-border',
};

export function Badge({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}
