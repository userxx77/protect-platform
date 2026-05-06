'use client';

import { Bell, Menu, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function Topbar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="border-border bg-background/80 sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-4 backdrop-blur">
      <button
        type="button"
        onClick={onMenu}
        className="border-border bg-surface/40 grid h-9 w-9 place-items-center rounded-md border md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="relative max-w-md flex-1">
        <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
        <Input placeholder="Search detections, members, servers…" className="h-9 pl-8" readOnly />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="border-border bg-surface/40 hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground sm:flex">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-primary" />
          live
        </div>
        <button
          type="button"
          className="border-border bg-surface/40 grid h-9 w-9 place-items-center rounded-md border hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="text-muted-foreground h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
