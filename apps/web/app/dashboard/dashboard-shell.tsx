'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Sidebar } from '@/components/shell/Sidebar';
import { Topbar } from '@/components/shell/Topbar';

export function DashboardShell({
  children,
  showAdmin,
  userName,
  userHint,
}: {
  children: React.ReactNode;
  showAdmin: boolean;
  userName: string;
  userHint?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen w-full">
      <div className="hidden md:block">
        <Sidebar showAdmin={showAdmin} userName={userName} userHint={userHint} />
      </div>

      {open ? (
        <div className="fixed inset-0 z-30 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close menu backdrop"
            onClick={() => setOpen(false)}
          />
          <div className="sentra-sidebar absolute left-0 top-0 h-full w-64 shadow-xl">
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-md"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
            <Sidebar
              showAdmin={showAdmin}
              userName={userName}
              userHint={userHint}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="fade-in mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
