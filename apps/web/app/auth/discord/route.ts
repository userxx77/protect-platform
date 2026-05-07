import { auth, signIn } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';

/** Must be a Route Handler: `signIn()` sets cookies; RSC pages are not allowed to mutate cookies. */
export const runtime = 'nodejs';

function safeCallbackPath(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/dashboard';
}

export async function GET(request: NextRequest) {
  const target = safeCallbackPath(request.nextUrl.searchParams.get('callbackUrl'));
  const session = await auth();
  if (session) {
    return NextResponse.redirect(new URL(target, request.nextUrl.origin));
  }
  await signIn('discord', { redirectTo: target });
}
