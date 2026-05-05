import { botLog } from '../log';

/**
 * Wait until Protect API /ready returns 2xx (operators run bot after API image is up).
 */
export async function waitForApiReady(
  baseUrl: string,
  opts?: { maxAttempts?: number; backoffMs?: number },
): Promise<void> {
  const maxAttempts = opts?.maxAttempts ?? 60;
  const backoffMs = opts?.backoffMs ?? 2000;
  const url = `${baseUrl.replace(/\/$/, '')}/ready`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        botLog('info', 'api_ready', { attempt, url });
        return;
      }
      botLog('warn', 'api_ready_poll_not_ready', { attempt, status: res.status });
    } catch (e) {
      botLog('warn', 'api_ready_poll_error', {
        attempt,
        error: String(e).slice(0, 300),
      });
    }
    await new Promise((r) => setTimeout(r, backoffMs));
  }

  throw new Error(`API not ready after ${maxAttempts} attempts (${url})`);
}
