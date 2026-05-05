import { NextResponse } from 'next/server';
import { apiV1Base, getDashboardBearer } from '@/lib/api-server';

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string; attachmentId: string }> },
) {
  try {
    const { id, attachmentId } = await context.params;
    const token = await getDashboardBearer();
    const base = apiV1Base();
    const r = await fetch(`${base}/me/tickets/${id}/attachments/${attachmentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      return new NextResponse(await r.text(), { status: r.status });
    }
    const buf = await r.arrayBuffer();
    const ct = r.headers.get('content-type') ?? 'application/octet-stream';
    return new NextResponse(buf, {
      headers: { 'Content-Type': ct },
    });
  } catch {
    return new NextResponse('Unauthorized', { status: 401 });
  }
}
