/**
 * Readiness: critical server-side env must be present (no DB in web app).
 */
import { evaluateWebProductionEnv } from '../../../lib/env-server';

export async function GET() {
  const { ready, checks } = evaluateWebProductionEnv();
  const body = {
    service: 'protect-web',
    ready,
    checks,
  };
  if (!ready) {
    return Response.json(body, { status: 503 });
  }
  return Response.json(body);
}
