import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { discordSignInPath } from '@/lib/discord-signin';

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

export default auth((req) => {
  const reqUrl = req.nextUrl;

  if (apexHosts.length && appOrigin) {
    const host = req.headers.get('host')?.split(':')[0]?.toLowerCase();
    if (host) {
      let targetHost: string;
      try {
        targetHost = new URL(appOrigin).hostname.toLowerCase();
      } catch {
        targetHost = '';
      }
      if (targetHost && apexHosts.includes(host) && host !== targetHost) {
        const pathname = `${reqUrl.pathname}${reqUrl.search}`;
        return NextResponse.redirect(new URL(pathname, appOrigin));
      }
    }
  }

  if (reqUrl.pathname.startsWith('/dashboard') && !req.auth) {
    const path = discordSignInPath(`${reqUrl.pathname}${reqUrl.search}`);
    return NextResponse.redirect(new URL(path, reqUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|ico|webp)$).*)',
  ],
};
