'use client';

import { signOut } from 'next-auth/react';

export function DashboardSignOut() {
  return (
    <button
      type="button"
      className="ds-btn ds-btn-ghost"
      style={{ width: '100%' }}
      onClick={() => void signOut({ callbackUrl: '/' })}
    >
      Sign out
    </button>
  );
}
