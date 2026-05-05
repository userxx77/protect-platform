import { auth } from '@/auth';
import { SignJWT } from 'jose';

function getSecretKey() {
  const s = process.env.DASHBOARD_JWT_SECRET;
  if (!s) {
    throw new Error('DASHBOARD_JWT_SECRET is required');
  }
  return new TextEncoder().encode(s);
}

export async function dashboardApi<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }
  const token = await new SignJWT({})
    .setSubject(session.user.id)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(getSecretKey());

  const raw = process.env.API_BASE_URL?.replace(/\/$/, '') ?? 'http://127.0.0.1:3001';
  const base = raw.endsWith('/v1') ? raw : `${raw}/v1`;
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...Object.fromEntries(new Headers(init.headers).entries()),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status} ${text}`);
  }
  return text ? (JSON.parse(text) as T) : (null as T);
}
