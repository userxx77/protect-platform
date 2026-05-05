import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UserPublic } from '@protect/shared';
import { RedisService } from '../redis/redis.service';
import { MetricsService } from '../metrics/metrics.service';

const key = (discordId: string) => `user:${discordId}`;
const stverKey = (discordId: string) => `user:stver:${discordId}`;
const negKey = (discordId: string) => `user:neg:${discordId}`;

/** Reject cache writes whose aggregate version is older than the stored version (atomic). */
const SET_IF_NEWER_LUA = `
local cur = redis.call('GET', KEYS[1])
if cur ~= false and tonumber(cur) > tonumber(ARGV[1]) then
  return 0
end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
redis.call('SET', KEYS[2], ARGV[3], 'EX', ARGV[2])
redis.call('DEL', KEYS[3])
return 1
`;

@Injectable()
export class UserCacheService {
  private readonly ttlSec: number;
  private readonly negTtlSec: number;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
    private readonly metrics: MetricsService,
  ) {
    this.ttlSec = Number(config.get('USER_CACHE_TTL_SEC') ?? 120);
    this.negTtlSec = Number(config.get('USER_NEGATIVE_CACHE_TTL_SEC') ?? 30);
  }

  async get(discordId: string): Promise<UserPublic | null> {
    const r = this.redis.raw;
    if (!r) {
      this.metrics.recordCacheBypass();
      return null;
    }
    const raw = await r.get(key(discordId));
    if (!raw) {
      this.metrics.recordCacheMiss();
      return null;
    }
    this.metrics.recordCacheHit();
    try {
      return JSON.parse(raw) as UserPublic;
    } catch {
      return null;
    }
  }

  async getNegativeMarker(discordId: string): Promise<boolean> {
    const r = this.redis.raw;
    if (!r) return false;
    if (this.negTtlSec <= 0) return false;
    const v = await r.get(negKey(discordId));
    return v === '1';
  }

  async setNegativeMarker(discordId: string): Promise<void> {
    const r = this.redis.raw;
    if (!r) return;
    if (this.negTtlSec <= 0) return;
    await r.set(negKey(discordId), '1', 'EX', this.negTtlSec);
  }

  /**
   * Always align Redis with DB-derived snapshot (read-through / repair / post-invalidate).
   */
  async setAuthoritative(discordId: string, value: UserPublic): Promise<void> {
    const r = this.redis.raw;
    if (!r) return;
    const ver = String(value.stateVersion ?? 0);
    const payload = JSON.stringify(value);
    const ttl = this.ttlSec;
    const multi = r.multi();
    multi.set(stverKey(discordId), ver, 'EX', ttl);
    multi.set(key(discordId), payload, 'EX', ttl);
    multi.del(negKey(discordId));
    await multi.exec();
  }

  /**
   * After a successful write: only update Redis if the new aggregate version is not stale
   * relative to the parallel version key (avoids concurrent writers clobbering newer state).
   */
  async setIfNewer(discordId: string, value: UserPublic): Promise<void> {
    const r = this.redis.raw;
    if (!r) return;
    const newVer = value.stateVersion ?? 0;
    const payload = JSON.stringify(value);
    await r.eval(
      SET_IF_NEWER_LUA,
      3,
      stverKey(discordId),
      key(discordId),
      negKey(discordId),
      String(newVer),
      String(this.ttlSec),
      payload,
    );
  }

  /** @deprecated Use setAuthoritative or setIfNewer */
  async set(discordId: string, value: UserPublic): Promise<void> {
    await this.setAuthoritative(discordId, value);
  }

  async invalidate(discordId: string): Promise<void> {
    const r = this.redis.raw;
    if (!r) return;
    await r.del(key(discordId), stverKey(discordId), negKey(discordId));
  }
}
