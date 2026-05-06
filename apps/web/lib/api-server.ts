import { auth } from '@/auth';
import { SignJWT } from 'jose';

function getSecretKey() {
  const s = process.env.DASHBOARD_JWT_SECRET;
  if (!s) {
    throw new Error('DASHBOARD_JWT_SECRET is required');
  }
  return new TextEncoder().encode(s);
}

export function apiV1Base(): string {
  const raw = process.env.API_BASE_URL?.replace(/\/$/, '') ?? 'http://127.0.0.1:3001';
  return raw.endsWith('/v1') ? raw : `${raw}/v1`;
}

function parseJsonBody<T>(text: string, path: string, status: number): T {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`API ${path} returned HTTP ${status} with an empty body`);
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(
      `API ${path} returned HTTP ${status} with non-JSON body: ${trimmed.slice(0, 240)}`,
    );
  }
}

export async function getDashboardBearer(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }
  return new SignJWT({})
    .setSubject(session.user.id)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(getSecretKey());
}

export async function dashboardApi<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getDashboardBearer();
  const base = apiV1Base();
  const initHeaders = Object.fromEntries(new Headers(init.headers).entries());
  const headers: Record<string, string> = {
    ...initHeaders,
    Authorization: `Bearer ${token}`,
  };
  if (init.body !== undefined && !headers['content-type'] && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers,
  });

  const text = await res.text();
  if (!res.ok) {
    const hint = text.trim().slice(0, 400);
    throw new Error(
      hint ? `HTTP ${res.status} ${path}: ${hint}` : `HTTP ${res.status} ${path}`,
    );
  }
  const method = (init.method ?? 'GET').toUpperCase();
  const trimmed = text.trim();
  if (!trimmed) {
    if (method === 'DELETE' || method === 'HEAD' || res.status === 204) {
      return undefined as T;
    }
    throw new Error(`API ${path} returned HTTP ${res.status} with an empty body`);
  }
  return parseJsonBody<T>(trimmed, path, res.status);
}

export async function dashboardFormPost(path: string, formData: FormData): Promise<void> {
  const token = await getDashboardBearer();
  const base = apiV1Base();
  const p = path.startsWith('/') ? path : `/${path}`;
  const res = await fetch(`${base}${p}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  const text = await res.text();
  if (!res.ok) {
    const hint = text.trim().slice(0, 400);
    throw new Error(
      hint ? `HTTP ${res.status} ${p}: ${hint}` : `HTTP ${res.status} ${p}`,
    );
  }
}
