'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  LayoutList,
} from 'lucide-react';
import { Logo } from '@/components/shell/Logo';
import { cn } from '@/lib/utils';
import { DashboardSignOut } from '@/app/components/DashboardSignOut';

const NAV: { href: string; label: string; icon: typeof LayoutDashboard }[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/tickets', label: 'My tickets', icon: Ticket },
  { href: '/dashboard/reports', label: 'My reports', icon: Flag },
  { href: '/dashboard/members', label: 'Members', icon: Users },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
];

const OPS: { href: string; label: string; icon: typeof Settings }[] = [
  { href: '/dashboard/my-servers', label: 'My servers', icon: LayoutList },
  { href: '/dashboard/config', label: 'Server config', icon: Settings },
  { href: '/dashboard/audit', label: 'Audit log', icon: ScrollText },
];

const ADMIN_NAV: { href: string; label: string; icon: typeof Server }[] = [
  { href: '/dashboard/admin/guilds', label: 'Guilds', icon: Server },
  { href: '/dashboard/admin/licenses', label: 'Licenses', icon: KeyRound },
  { href: '/dashboard/admin/stats', label: 'Snapshot', icon: BarChart3 },
  { href: '/dashboard/admin/tickets', label: 'Tickets', icon: Ticket },
  { href: '/dashboard/admin/reports', label: 'Reports queue', icon: Flag },
];

function isNavActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  label,
  icon: Icon,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
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
  const initial = userName.replace(/^@/, '').charAt(0).toUpperCase() || '?';
  return (
    <aside className="bg-background/60 flex h-full w-60 flex-col border-r border-border px-3 py-4">
      <div className="px-2 pb-4">
        <Logo />
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV.map((n) => (
          <NavLink key={n.href} {...n} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="text-muted-foreground/70 mt-6 px-2.5 text-[10px] font-semibold uppercase tracking-wider">
        Operations
      </div>
      <nav className="mt-1 flex flex-col gap-0.5">
        {OPS.map((n) => (
          <NavLink key={n.href} {...n} onNavigate={onNavigate} />
        ))}
      </nav>

      {showAdmin ? (
        <>
          <div className="text-muted-foreground/70 mt-6 px-2.5 text-[10px] font-semibold uppercase tracking-wider">
            Admin
          </div>
          <nav className="mt-1 flex flex-col gap-0.5">
            {ADMIN_NAV.map((n) => (
              <NavLink key={n.href} {...n} onNavigate={onNavigate} />
            ))}
          </nav>
        </>
      ) : null}

      <div className="border-border bg-surface/60 mt-auto rounded-lg border p-3">
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
