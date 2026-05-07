import { NextResponse, type NextRequest } from 'next/server';
import { discordSignInPath } from '@/lib/discord-signin';
import { hasLikelySessionCookie } from '@/lib/auth-session-cookie';

/**
 * When the dashboard is also reachable on the apex (e.g. sentra.gg), redirect to the
 * canonical host so NextAuth cookies and Discord OAuth callbacks stay on one origin.
 *
 * Set in .env (rebuild web image after change — NEXT_PUBLIC_* inlined at build):
 *   NEXT_PUBLIC_APEX_HOSTS=sentra.gg,www.sentra.gg
 *   NEXT_PUBLIC_APP_ORIGIN=https://dashboard.sentra.gg
 *
 * Leave NEXT_PUBLIC_APEX_HOSTS empty to disable.
 *
 * Do NOT wrap with Auth.js `auth()` here — Edge + JWT init caused Configuration errors on OAuth.
 * Session presence is cookie-only; RSC `auth()` still validates on /dashboard.
 */
const apexHosts = (process.env.NEXT_PUBLIC_APEX_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

const appOrigin = (process.env.NEXT_PUBLIC_APP_ORIGIN ?? '').replace(/\/$/, '');

export function middleware(req: NextRequest) {
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

  const path = reqUrl.pathname;
  const atRoot = path === '/';
  const atDashboard = path.startsWith('/dashboard');

  if (atRoot || atDashboard) {
    const signedIn = hasLikelySessionCookie(req);

    if (atRoot && signedIn) {
      return NextResponse.redirect(new URL('/dashboard', reqUrl.origin));
    }

    if (!signedIn) {
      const oauthPath = discordSignInPath('/dashboard');
      return NextResponse.redirect(new URL(oauthPath, reqUrl.origin));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|ico|webp)$).*)',
  ],
};
