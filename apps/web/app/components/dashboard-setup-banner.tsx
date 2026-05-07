'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const STORAGE_KEY = 'sentra_onboarding_banner_dismissed';

export function DashboardSetupBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) !== '1') {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="border-primary/35 bg-primary-soft/20 mb-4 flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm">
        <span className="font-medium">Welcome to Sentra.</span>{' '}
        <span className="text-muted-foreground">
          Follow the welcome guide to set up your server and reports.
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" asChild>
          <Link href="/dashboard/welcome">Open welcome guide</Link>
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={dismiss} aria-label="Dismiss">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
