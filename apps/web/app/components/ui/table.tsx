import * as React from 'react';
import { cn } from '@/lib/utils';

export function Table({ className, ...p }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="scroll-thin relative w-full overflow-auto">
      <table className={cn('w-full caption-bottom text-sm', className)} {...p} />
    </div>
  );
}

export const Thead = (p: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead
    {...p}
    className={cn('text-[11px] uppercase tracking-wider text-muted-foreground', p.className)}
  />
);

export const Tbody = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody {...p} />;

export const Tr = ({ className, ...p }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr
    className={cn('border-border/60 border-b transition-colors hover:bg-surface/40', className)}
    {...p}
  />
);

export const Th = ({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn('h-10 px-3 text-left font-medium', className)} {...p} />
);

export const Td = ({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('px-3 py-2.5 align-middle', className)} {...p} />
);
