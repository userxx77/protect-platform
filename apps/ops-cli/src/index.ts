#!/usr/bin/env node
import Redis from 'ioredis';
import pc from 'picocolors';
import { EVENT_CHANNELS } from '@protect/shared';
import {
  formatEventLine,
  parseTailArgs,
  parseUserArgs,
  type EventEnvelope,
} from './format-event';

const channels = Object.values(EVENT_CHANNELS) as string[];

function opsStatsHeaders(): Record<string, string> | undefined {
  const k = process.env.SENTRA_OPS_STATS_KEY?.trim();
  if (!k) return undefined;
  return { Authorization: `Bearer ${k}` };
}

async function printStatsFooter(url: string): Promise<void> {
  try {
    const r = await fetch(url, { headers: opsStatsHeaders() });
    if (!r.ok) return;
    const s = (await r.json()) as {
      guildsActive?: number;
      trackedMemberDistinct?: number;
      usersFlagged?: number;
      manualChecksTotal?: number;
    };
    process.stdout.write(
      `\r${pc.dim('— stats —')} guilds ${s.guildsActive ?? '?'} · tracked ${s.trackedMemberDistinct ?? '?'} · flagged ${s.usersFlagged ?? '?'} · checks ${s.manualChecksTotal ?? '?'}\x1b[K\n`,
    );
  } catch {
    /* ignore */
  }
}

async function main(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    process.stderr.write(pc.red('REDIS_URL is required\n'));
    process.exit(1);
  }

  const userArgv = parseUserArgs(process.argv.slice(2));
  const { enrich, statsSec } = parseTailArgs(userArgv);
  const token = process.env.DISCORD_BOT_TOKEN;
  const apiBase = (
    process.env.API_PUBLIC_URL ??
    process.env.API_BASE_URL ??
    'http://127.0.0.1:3001'
  ).replace(/\/$/, '');
  const statsUrl = apiBase.includes('/v1')
    ? `${apiBase}/public/platform-stats`
    : `${apiBase}/v1/public/platform-stats`;

  if (statsSec > 0 && !process.env.SENTRA_OPS_STATS_KEY?.trim()) {
    process.stderr.write(
      pc.yellow(
        'SENTRA_OPS_STATS_KEY is unset — platform-stats footer requests will fail until you set it (same value as API).\n',
      ),
    );
  }

  process.stdout.write(
    pc.green(
      `sentra monitor listening on ${channels.length} Redis channels (enrich=${enrich})…\n`,
    ),
  );

  const sub = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
  const cache = new Map<string, string>();

  let statsTimer: ReturnType<typeof setInterval> | undefined;
  if (statsSec > 0) {
    statsTimer = setInterval(() => {
      void printStatsFooter(statsUrl);
    }, statsSec * 1000);
  }

  const onMessage = (_ch: string, message: string) => {
    void (async () => {
      try {
        const env = JSON.parse(message) as EventEnvelope;
        const line = await formatEventLine(env, enrich && !!token, token, cache);
        process.stdout.write(`${line}\n`);
      } catch {
        process.stdout.write(pc.dim(`(parse error) ${message.slice(0, 120)}\n`));
      }
    })();
  };

  sub.on('message', onMessage);
  await sub.subscribe(...channels);
  process.stdout.write(pc.dim(`stats poll: ${statsUrl} every ${statsSec}s\n`));

  const shutdown = async () => {
    if (statsTimer) clearInterval(statsTimer);
    sub.off('message', onMessage);
    await sub.quit();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((e) => {
  process.stderr.write(pc.red(String(e)));
  process.exit(1);
});
