'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function navActive(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = navActive(pathname, href);
  return (
    <Link href={href} className={`ds-nav-link${active ? ' ds-nav-link-active' : ''}`}>
      {children}
    </Link>
  );
}
