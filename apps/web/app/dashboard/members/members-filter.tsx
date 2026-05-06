'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function MembersFilter({
  servers,
  children,
}: {
  servers: string[];
  children: (selectedServer: string) => ReactNode;
}) {
  const [server, setServer] = useState(servers[0] ?? 'All');

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {servers.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setServer(s)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition-colors',
              server === s
                ? 'border-primary/40 bg-primary-soft text-primary'
                : 'border-border bg-surface/40 text-muted-foreground hover:text-foreground',
            )}
          >
            {s}
          </button>
        ))}
      </div>
      {children(server)}
    </>
  );
}
