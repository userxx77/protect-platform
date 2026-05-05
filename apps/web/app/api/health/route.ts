export async function GET() {
  return Response.json({
    status: 'ok' as const,
    service: 'protect-web',
    uptimeSec: process.uptime(),
  });
}
