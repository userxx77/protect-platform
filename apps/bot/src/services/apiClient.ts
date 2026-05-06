import { randomUUID } from 'node:crypto';
import type { Env } from '../config/env';
import { apiBaseV1 } from '../config/env';
import { botLog } from '../log';
import { CircuitBreaker } from './circuitBreaker';
import type { ServerApiResponse } from './apiTypes';
import { ServerConfigCache } from './serverConfigCache';
import { GuildRateLimiter } from './guildRateLimiter';

export type { UserApiResponse, ServerApiResponse } from './apiTypes';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type PublicStats = {
  guildsActive: number;
  trackedMemberDistinct: number;
  usersFlagged: number;
  manualChecksTotal: number;
  updatedAt: string;
};

export class ApiClient {
  private readonly base: string;
  private readonly circuit: CircuitBreaker;
  private readonly serverCache: ServerConfigCache<ServerApiResponse>;
  readonly guildRate: GuildRateLimiter;

  constructor(private readonly env: Env) {
    this.base = apiBaseV1(env);
    this.circuit = new CircuitBreaker(
      env.CIRCUIT_FAILURE_THRESHOLD,
      env.CIRCUIT_OPEN_MS,
    );
    this.serverCache = new ServerConfigCache<ServerApiResponse>(
      env.SERVER_CONFIG_CACHE_TTL_MS,
    );
    this.guildRate = new GuildRateLimiter(env.GUILD_COMMANDS_PER_MINUTE);
  }

  invalidateServerCache(guildId: string): void {
    this.serverCache.invalidate(guildId);
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.env.BOT_API_KEY,
    };
  }

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    let lastErr: unknown;
    const max = this.env.API_RETRY_MAX;
    for (let attempt = 0; attempt <= max; attempt++) {
      try {
        const r = await fetch(url, init);
        if (r.status === 502 || r.status === 503 || r.status === 429) {
          lastErr = new Error(`HTTP ${r.status}`);
          const backoff = Math.min(2000, 200 * 2 ** attempt);
          if (attempt < max) await sleep(backoff);
          continue;
        }
        return r;
      } catch (e) {
        lastErr = e;
        const backoff = Math.min(2000, 200 * 2 ** attempt);
        if (attempt < max) await sleep(backoff);
      }
    }
    throw lastError(lastErr);
  }

  async requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    this.circuit.beforeCall();
    const url = `${this.base}${path.startsWith('/') ? path : `/${path}`}`;
    try {
      const traceId = randomUUID();
      const r = await this.fetchWithRetry(url, {
        ...init,
        headers: {
          ...this.headers(),
          'x-request-id': traceId,
          'x-correlation-id': traceId,
          ...normalizeHeaders(init.headers),
        },
      });
      const text = await r.text();
      if (!r.ok) {
        if (r.status >= 500 || r.status === 429) {
          this.circuit.recordFailure();
        }
        throw new Error(`${init.method ?? 'GET'} ${path} failed: ${r.status} ${text}`);
      }
      this.circuit.recordSuccess();
      return text ? (JSON.parse(text) as T) : (null as T);
    } catch (e) {
      const msg = (e as Error).message ?? '';
      if (
        msg !== 'CIRCUIT_OPEN' &&
        !/failed: \d{3}/.test(msg)
      ) {
        this.circuit.recordFailure();
      }
      throw e;
    }
  }

  async getPublicStats(): Promise<PublicStats> {
    return this.requestJson<PublicStats>('/bot/public-stats');
  }

  async getDiscordCapabilities(discordId: string): Promise<{
    platformRole: string;
    canSubmitCommunityReport: boolean;
  }> {
    return this.requestJson(`/bot/discord/${discordId}/capabilities`);
  }

  async postBotServerConfig(body: {
    guildId: string;
    actorDiscordId: string;
    config: Record<string, unknown>;
  }): Promise<unknown> {
    return this.requestJson('/bot/server/config', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getUser(discordId: string): Promise<import('./apiTypes').UserApiResponse> {
    return this.requestJson(`/user/${discordId}`, {
      headers: { 'x-protect-skip-user-cache': 'true' },
    });
  }

  async postReport(body: {
    reporterDiscordId: string;
    targetDiscordId: string;
    reason: string;
    guildId?: string;
    allegedFlagLevel?: string;
  }): Promise<unknown> {
    return this.requestJson('/report', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async postFlag(body: {
    targetDiscordId: string;
    actorDiscordId: string;
    reason: string;
    guildId?: string;
    adminOverride?: boolean;
    severity?: string;
  }): Promise<unknown> {
    return this.requestJson('/flag', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getServer(guildId: string): Promise<ServerApiResponse> {
    const cached = this.serverCache.get(guildId);
    if (cached && this.serverCache.isFresh(cached)) {
      return cached.data;
    }
    try {
      const data = await this.requestJson<ServerApiResponse>(`/server/${guildId}`);
      this.serverCache.set(guildId, data);
      return data;
    } catch (e) {
      if (cached) {
        botLog('warn', 'api_degraded_using_stale_server_config', { guildId });
        return cached.data;
      }
      throw e;
    }
  }

  async getGuildLicenseSummary(guildId: string): Promise<{ licensed: boolean }> {
    return this.requestJson<{ licensed: boolean }>(`/bot/guild/${guildId}/summary`);
  }

  async postGuildLifecycle(body: {
    guildId: string;
    event: 'join' | 'leave';
    discordName?: string | null;
    iconHash?: string | null;
    approximateMemberCount?: number | null;
    ownerDiscordId?: string | null;
    vanityUrlCode?: string | null;
    premiumTier?: number | null;
  }): Promise<unknown> {
    return this.requestJson('/bot/guild/lifecycle', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async postMembersBatch(
    guildId: string,
    members: Array<{
      discordUserId: string;
      username?: string | null;
      globalName?: string | null;
      avatarHash?: string | null;
    }>,
  ): Promise<{ upserted: number }> {
    return this.requestJson<{ upserted: number }>(`/bot/guild/${guildId}/members/batch`, {
      method: 'POST',
      body: JSON.stringify({ members }),
    });
  }

  async postMembersSyncDone(guildId: string): Promise<unknown> {
    return this.requestJson(`/bot/guild/${guildId}/members/sync-done`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async postIncrementCheckCounter(): Promise<unknown> {
    return this.requestJson('/bot/stats/increment-check', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async postBotAdminEntitlement(
    guildId: string,
    actorDiscordId: string,
    body: {
      status: string;
      validFrom: string;
      validUntil?: string | null;
      planCode?: string | null;
    },
  ): Promise<unknown> {
    return this.requestJson(`/bot/admin/guilds/${guildId}/entitlement`, {
      method: 'POST',
      headers: { 'x-actor-discord-id': actorDiscordId },
      body: JSON.stringify(body),
    });
  }

  async postBotAdminSyncMembers(
    guildId: string,
    actorDiscordId: string,
  ): Promise<unknown> {
    return this.requestJson(`/bot/admin/guilds/${guildId}/sync-members`, {
      method: 'POST',
      headers: { 'x-actor-discord-id': actorDiscordId },
      body: JSON.stringify({}),
    });
  }
}

function normalizeHeaders(h: RequestInit['headers'] | undefined): Record<string, string> {
  if (!h) return {};
  if (h instanceof Headers) {
    const out: Record<string, string> = {};
    h.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(h)) {
    return Object.fromEntries(h) as Record<string, string>;
  }
  const o = h as Record<string, string | readonly string[]>;
  const out: Record<string, string> = {};
  for (const k of Object.keys(o)) {
    const v = o[k];
    out[k] = Array.isArray(v) ? v[0] ?? '' : String(v);
  }
  return out;
}

function lastError(e: unknown): Error {
  if (e instanceof Error) return e;
  return new Error(String(e));
}
