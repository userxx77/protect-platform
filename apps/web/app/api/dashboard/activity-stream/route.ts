import { getDashboardBearer, apiV1Base } from '@/lib/api-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  let token: string;
  try {
    token = await getDashboardBearer();
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }

  const up = await fetch(`${apiV1Base()}/me/dashboard/activity-stream`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'text/event-stream',
    },
  });

  if (!up.ok || !up.body) {
    return new Response('Upstream error', { status: 502 });
  }

  return new Response(up.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
