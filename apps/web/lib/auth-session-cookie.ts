import type { NextRequest } from 'next/server';

/** Auth.js v5 JWT session cookies + legacy NextAuth names (HTTPS variants). */
const SESSION_COOKIE_NAMES = [
  '__Host-authjs.session-token',
  '__Secure-authjs.session-token',
  'authjs.session-token',
  '__Secure-next-auth.session-token',
  'next-auth.session-token',
] as const;

export function hasLikelySessionCookie(req: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((name) => req.cookies.has(name));
}
