import pc from 'picocolors';

export type EventEnvelope = {
  eventId?: string;
  type?: string;
  correlationId?: string;
  occurredAt?: string;
  payload?: Record<string, unknown>;
};

export async function resolveDiscord(
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

function pipeSafe(s: string, max = 120): string {
  const t = s.replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function ts(env: EventEnvelope): string {
  const raw = env.occurredAt
    ? new Date(env.occurredAt).toISOString()
    : new Date().toISOString();
  return pc.dim(raw);
}

/** Single-line SaaS-style log row (one event). */
export async function formatEventLine(
  env: EventEnvelope,
  enrich: boolean,
  token: string | undefined,
  cache: Map<string, string>,
): Promise<string> {
  const t = env.type ?? 'unknown';
  const p = env.payload ?? {};
  const T = ts(env);

  if (t === 'guild.discovered') {
    const gid = String(p.guildId ?? '—');
    const name =
      typeof p.name === 'string' && p.name
        ? p.name
        : enrich && token
          ? await resolveDiscord(token, cache, 'guild', gid)
          : '—';
    const members =
      p.approximateMemberCount != null ? String(p.approximateMemberCount) : '—';
    return `${T} ${pc.bold('[GUILD]')} ${pipeSafe(name)} | ${members} | ${gid} | ${pc.cyan('discovered')}`;
  }

  if (t === 'guild.members.sync') {
    const gid = String(p.guildId ?? '—');
    let name = '—';
    let members = '—';
    if (enrich && token) {
      name = await resolveDiscord(token, cache, 'guild', gid);
      try {
        const r = await fetch(`https://discord.com/api/v10/guilds/${gid}?with_counts=true`, {
          headers: { Authorization: `Bot ${token}` },
        });
        if (r.ok) {
          const j = (await r.json()) as { approximate_member_count?: number };
          if (j.approximate_member_count != null) {
            members = String(j.approximate_member_count);
          }
        }
      } catch {
        /* ignore */
      }
    }
    return `${T} ${pc.bold('[GUILD]')} ${pipeSafe(name)} | ${members} | ${gid} | ${pc.blue('member sync')}`;
  }

  if (t === 'report.pending') {
    const targetId = String(p.targetDiscordId ?? '—');
    const reporterId = String(p.reporterDiscordId ?? '—');
    let reporterN = reporterId;
    let targetN = targetId;
    if (enrich && token) {
      [reporterN, targetN] = await Promise.all([
        resolveDiscord(token, cache, 'user', reporterId),
        resolveDiscord(token, cache, 'user', targetId),
      ]);
    }
    const reason = pipeSafe(typeof p.reason === 'string' ? p.reason : '—', 100);
    return `${T} ${pc.bold('[REPORT]')} ${pipeSafe(reporterN)} | ${pipeSafe(targetN)} | ${targetId} | ${reason} | ${pc.yellow('pending review')}`;
  }

  if (t === 'user.reported') {
    const targetId = String(p.targetDiscordId ?? '—');
    const reporterId = String(p.reporterDiscordId ?? '—');
    let reporterN = reporterId;
    let targetN = targetId;
    if (enrich && token) {
      [reporterN, targetN] = await Promise.all([
        resolveDiscord(token, cache, 'user', reporterId),
        resolveDiscord(token, cache, 'user', targetId),
      ]);
    }
    const reason = pipeSafe(typeof p.reason === 'string' ? p.reason : '—', 100);
    const action =
      typeof env.eventId === 'string' && env.eventId.includes('approved')
        ? pc.green('approved / flagged')
        : pc.magenta('submitted');
    return `${T} ${pc.bold('[REPORT]')} ${pipeSafe(reporterN)} | ${pipeSafe(targetN)} | ${targetId} | ${reason} | ${action}`;
  }

  if (t === 'user.flagged') {
    const targetId = String(p.targetDiscordId ?? '—');
    let uname = targetId;
    let gname = '—';
    if (enrich && token) {
      uname = await resolveDiscord(token, cache, 'user', targetId);
      if (p.guildId) {
        gname = await resolveDiscord(token, cache, 'guild', String(p.guildId));
      }
    } else if (p.guildId) {
      gname = String(p.guildId);
    }
    const lvl = String(p.flagLevel ?? '—');
    const score = String(p.flagScore ?? '—');
    return `${T} ${pc.bold('[FLAG]')} ${pipeSafe(uname)} | ${targetId} | ${lvl} | score ${score} | ${pipeSafe(gname)} | ${pc.red('flagged')}`;
  }

  if (t === 'user.updated') {
    const id = String(p.discordId ?? '—');
    let uname = id;
    if (enrich && token) {
      uname = await resolveDiscord(token, cache, 'user', id);
    }
    return `${T} ${pc.bold('[USER]')} ${pipeSafe(uname)} | ${id} | ${String(p.flagLevel ?? '—')} | ${String(p.flagScore ?? '—')} | ${pc.green('updated')}`;
  }

  if (t === 'server.config.updated') {
    const gid = String(p.guildId ?? '—');
    let name = '—';
    if (enrich && token) {
      name = await resolveDiscord(token, cache, 'guild', gid);
    }
    return `${T} ${pc.bold('[CONFIG]')} ${pipeSafe(name)} | ${gid} | ${pc.dim('alert settings updated')}`;
  }

  return `${T} ${pc.bold(`[${t}]`)} ${pc.dim(pipeSafe(JSON.stringify(p), 200))}`;
}

export function parseUserArgs(argv: string[]): string[] {
  const a = [...argv];
  if (a[0] === 'monitor') a.shift();
  return a;
}

export function parseTailArgs(argv: string[]): { enrich: boolean; statsSec: number } {
  const enrich = argv.includes('--enrich');
  const idx = argv.findIndex((x) => x === '--stats-interval' || x.startsWith('--stats-interval='));
  let statsSec = 30;
  if (idx >= 0) {
    const v = argv[idx].includes('=') ? argv[idx].split('=')[1] : argv[idx + 1];
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) statsSec = Math.min(n, 600);
  }
  return { enrich, statsSec };
}
