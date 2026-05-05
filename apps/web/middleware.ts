import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * When the dashboard is also reachable on the apex (e.g. sentra.gg), redirect to the
 * canonical host so NextAuth cookies and Discord OAuth callbacks stay on one origin.
 *
 * Set in .env (rebuild web image after change — NEXT_PUBLIC_* inlined at build):
 *   NEXT_PUBLIC_APEX_HOSTS=sentra.gg,www.sentra.gg
 *   NEXT_PUBLIC_APP_ORIGIN=https://dashboard.sentra.gg
 *
 * Leave NEXT_PUBLIC_APEX_HOSTS empty to disable.
 */
const apexHosts = (process.env.NEXT_PUBLIC_APEX_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

const appOrigin = (process.env.NEXT_PUBLIC_APP_ORIGIN ?? '').replace(/\/$/, '');

export function middleware(request: NextRequest) {
  if (!apexHosts.length || !appOrigin) {
    return NextResponse.next();
  }

  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase();
  if (!host || !apexHosts.includes(host)) {
    return NextResponse.next();
  }

  let targetHost: string;
  try {
    targetHost = new URL(appOrigin).hostname.toLowerCase();
  } catch {
    return NextResponse.next();
  }

  if (host === targetHost) {
    return NextResponse.next();
  }

  const pathname = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  return NextResponse.redirect(new URL(pathname, appOrigin));
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|ico|webp)$).*)',
  ],
};
