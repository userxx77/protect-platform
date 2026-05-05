#!/usr/bin/env node
import Redis from 'ioredis';
import pc from 'picocolors';
import { EVENT_CHANNELS } from '@protect/shared';

type Envelope = {
  eventId?: string;
  type?: string;
  correlationId?: string;
  occurredAt?: string;
  payload?: Record<string, unknown>;
};

const channels = Object.values(EVENT_CHANNELS) as string[];

function parseArgs(): { enrich: boolean; statsSec: number } {
  const argv = process.argv.slice(2);
  const enrich = argv.includes('--enrich');
  const idx = argv.findIndex((a) => a === '--stats-interval' || a.startsWith('--stats-interval='));
  let statsSec = 30;
  if (idx >= 0) {
    const v = argv[idx].includes('=') ? argv[idx].split('=')[1] : argv[idx + 1];
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) statsSec = Math.min(n, 600);
  }
  return { enrich, statsSec };
}

async function resolveDiscord(
  token: string,
  cache: Map<string, string>,
  kind: 'user' | 'guild',
  id: string | null | undefined,
): Promise<string> {
  if (!id) return '—';
  const key = `${kind}:${id}`;
  if (cache.has(key)) return cache.get(key)!;
  try {
    const path = kind === 'user' ? `users/${id}` : `guilds/${id}`;
    const r = await fetch(`https://discord.com/api/v10/${path}`, {
      headers: { Authorization: `Bot ${token}` },
    });
    if (!r.ok) {
      cache.set(key, id);
      return id;
    }
    const j = (await r.json()) as {
      username?: string;
      global_name?: string;
      name?: string;
    };
    const label =
      kind === 'user'
        ? [j.global_name, j.username].filter(Boolean).join(' @') || id
        : j.name || id;
    cache.set(key, label);
    return label;
  } catch {
    cache.set(key, id);
    return id;
  }
}

async function formatLine(
  env: Envelope,
  enrich: boolean,
  token: string | undefined,
  cache: Map<string, string>,
): Promise<string> {
  const t = env.type ?? 'unknown';
  const ts = env.occurredAt
    ? pc.dim(new Date(env.occurredAt).toISOString())
    : pc.dim(new Date().toISOString());
  const p = env.payload ?? {};

  const head = `${ts} ${pc.bold(t)} ${pc.dim(env.eventId?.slice(0, 8) ?? '')}`;

  if (t === 'guild.discovered') {
    const gid = p.guildId as string | undefined;
    const gname = enrich && token ? await resolveDiscord(token, cache, 'guild', gid) : gid;
    return `${head}\n  ${pc.cyan('guild')} ${gname ?? '—'} ${pc.dim(`(${gid ?? '—'})`)} ~${String(p.approximateMemberCount ?? '?')} members`;
  }

  if (t === 'report.pending' && enrich && token) {
    const tg = (p.targetDiscordId as string) ?? '';
    const rp = (p.reporterDiscordId as string) ?? '';
    const [tn, rn] = await Promise.all([
      resolveDiscord(token, cache, 'user', tg),
      resolveDiscord(token, cache, 'user', rp),
    ]);
    return `${head}\n  ${pc.yellow('report')} ${p.reportId} target ${tn} (${tg}) by ${rn} guild ${p.guildId ?? '—'}`;
  }

  if (t === 'user.flagged' && enrich && token) {
    const tid = (p.targetDiscordId as string) ?? '';
    const uname = await resolveDiscord(token, cache, 'user', tid);
    const gname = p.guildId
      ? await resolveDiscord(token, cache, 'guild', p.guildId as string)
      : '—';
    return `${head}\n  ${pc.red('flagged')} ${uname} (${tid}) ${p.flagLevel} score ${p.flagScore} guild ${gname}`;
  }

  if (t === 'report.pending') {
    return `${head}\n  ${pc.yellow('report')} ${p.reportId} target ${p.targetDiscordId} by ${p.reporterDiscordId} guild ${p.guildId ?? '—'}`;
  }

  if (t === 'user.reported') {
    return `${head}\n  ${pc.magenta('reported')} ${p.targetDiscordId} by ${p.reporterDiscordId} ${p.reportId}`;
  }

  if (t === 'user.updated') {
    return `${head}\n  ${pc.green('user.updated')} ${p.discordId} → ${p.flagLevel} (${p.flagScore})`;
  }

  if (t === 'guild.members.sync') {
    return `${head}\n  ${pc.blue('sync')} guild ${p.guildId}`;
  }

  if (t === 'server.config.updated') {
    return `${head}\n  ${pc.dim('config')} guild ${p.guildId}`;
  }

  if (t === 'user.flagged') {
    return `${head}\n  ${pc.red('flagged')} ${p.targetDiscordId} ${p.flagLevel} score ${p.flagScore} guild ${p.guildId ?? '—'}`;
  }

  return `${head}\n  ${pc.dim(JSON.stringify(p))}`;
}

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

  const { enrich, statsSec } = parseArgs();
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
      `sentra-tail listening on ${channels.length} Redis channels (enrich=${enrich})…\n`,
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
        const env = JSON.parse(message) as Envelope;
        const line = await formatLine(env, enrich && !!token, token, cache);
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
