'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Ticket,
  Flag,
  Users,
  BarChart3,
  Server,
  KeyRound,
  Settings,
  ScrollText,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Logo } from '@/components/shell/Logo';
import { cn } from '@/lib/utils';
import { DashboardSignOut } from '@/app/components/DashboardSignOut';

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/dashboard/reports', label: 'Meldingen', icon: Flag },
  { href: '/dashboard/tickets', label: 'Tickets', icon: Ticket },
  { href: '/dashboard/server-setup', label: 'Server instellen', icon: Settings },
];

const MORE_NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/dashboard/members', label: 'Leden', icon: Users },
  { href: '/dashboard/analytics', label: 'Statistieken', icon: BarChart3 },
  { href: '/dashboard/audit', label: 'Logboek', icon: ScrollText },
];

const ADMIN_NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/dashboard/admin/reports', label: 'Meldingen beoordelen', icon: Flag },
  { href: '/dashboard/admin/guilds', label: 'Servers', icon: Server },
  { href: '/dashboard/admin/licenses', label: 'Licenties', icon: KeyRound },
  { href: '/dashboard/admin/stats', label: 'Platform', icon: BarChart3 },
  { href: '/dashboard/admin/tickets', label: 'Supporttickets', icon: Ticket },
];

function isNavActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isMoreActive(pathname: string) {
  return MORE_NAV.some((n) => isNavActive(pathname, n.href));
}

function NavLink({
  href,
  label,
  icon: Icon,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = isNavActive(pathname, href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
        active
          ? 'bg-primary-soft text-primary'
          : 'text-muted-foreground hover:bg-surface hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

export function Sidebar({
  onNavigate,
  showAdmin,
  userName,
  userHint,
}: {
  onNavigate?: () => void;
  showAdmin: boolean;
  userName: string;
  userHint?: string;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(() => isMoreActive(pathname));

  const initial = userName.replace(/^@/, '').charAt(0).toUpperCase() || '?';
  return (
    <aside className="sentra-sidebar flex h-full w-60 flex-col px-3 py-4">
      <div className="px-2 pb-4">
        <Logo />
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV.map((n) => (
          <NavLink key={n.href} href={n.href} label={n.label} icon={n.icon} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="mt-1">
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          className="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm"
        >
          {moreOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Meer
        </button>
        {moreOpen ? (
          <nav className="mt-0.5 flex flex-col gap-0.5 border-l border-border/60 ml-2 pl-2">
            {MORE_NAV.map((n) => (
              <NavLink key={n.href} href={n.href} label={n.label} icon={n.icon} onNavigate={onNavigate} />
            ))}
          </nav>
        ) : null}
      </div>

      {showAdmin ? (
        <>
          <div className="text-muted-foreground/70 mt-6 px-2.5 text-[10px] font-semibold uppercase tracking-wider">
            Beheer
          </div>
          <nav className="mt-1 flex flex-col gap-0.5">
            {ADMIN_NAV.map((n) => (
              <NavLink key={n.href} href={n.href} label={n.label} icon={n.icon} onNavigate={onNavigate} />
            ))}
          </nav>
        </>
      ) : null}

      <div className="border-border bg-surface/60 mt-auto rounded-lg border p-3">
        <Link
          href="/dashboard/welcome"
          className="text-primary mb-2 block text-[11px] hover:underline"
          onClick={onNavigate}
        >
          Startgids
        </Link>
        <div className="flex items-center gap-2">
          <div className="text-primary-foreground grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.4_0.2_295)] text-[11px] font-semibold">
            {initial}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-xs font-medium">{userName}</div>
            {userHint ? (
              <div className="text-muted-foreground truncate text-[10.5px]">{userHint}</div>
            ) : null}
          </div>
        </div>
        <div className="mt-3">
          <DashboardSignOut />
        </div>
      </div>
    </aside>
  );
}
