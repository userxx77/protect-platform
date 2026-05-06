'use client';

import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export function DashboardSignOut() {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={() => void signOut({ callbackUrl: '/' })}
    >
      Sign out
    </Button>
  );
}
