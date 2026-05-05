import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class ReportsAntiAbuseService {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  private dedupeWindowSec(): number {
    return Number(this.config.get('REPORT_DEDUPE_WINDOW_SEC') ?? 86_400);
  }

  private cooldownSec(): number {
    return Number(this.config.get('REPORT_COOLDOWN_SEC') ?? 120);
  }

  private maxPerDay(): number {
    return Number(this.config.get('REPORT_MAX_PER_REPORTER_DAY') ?? 30);
  }

  dedupeKey(
    reporterDiscordId: string,
    targetDiscordId: string,
    guildId: string | undefined,
    reason: string,
  ): string {
    const norm = reason.trim().toLowerCase().slice(0, 500);
    const raw = `${reporterDiscordId}|${targetDiscordId}|${guildId ?? ''}|${norm}`;
    return createHash('sha256').update(raw).digest('hex').slice(0, 32);
  }

  async assertCanReport(params: {
    reporterDiscordId: string;
    targetDiscordId: string;
    guildId?: string | null;
    reason: string;
    prismaDedupeLookup: (key: string, since: Date) => Promise<{ id: string } | null>;
  }): Promise<{ dedupeKey: string }> {
    const dedupeKey = this.dedupeKey(
      params.reporterDiscordId,
      params.targetDiscordId,
      params.guildId ?? undefined,
      params.reason,
    );

    const since = new Date(Date.now() - this.dedupeWindowSec() * 1000);
    const dup = await params.prismaDedupeLookup(dedupeKey, since);
    if (dup) {
      throw new ConflictException({ code: 'DUPLICATE_REPORT', reportId: dup.id });
    }

    if (!this.redis.raw) {
      throw new ServiceUnavailableException(
        'Report intake requires Redis (rate limits); try again later',
      );
    }

    const dayKey = `reports:reporter:${params.reporterDiscordId}:day`;
    const n = await this.redis.raw.incr(dayKey);
    if (n === 1) {
      await this.redis.raw.expire(dayKey, 86_400);
    }
    if (n > this.maxPerDay()) {
      await this.redis.raw.decr(dayKey);
      throw new HttpException({ code: 'REPORT_SPAM_CAP' }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const cooldownRedisKey = `report:cooldown:${params.reporterDiscordId}:${params.guildId ?? 'global'}`;
    const ok = await this.redis.raw.set(
      cooldownRedisKey,
      '1',
      'EX',
      this.cooldownSec(),
      'NX',
    );
    if (ok !== 'OK') {
      await this.redis.raw.decr(dayKey);
      throw new HttpException({ code: 'REPORT_COOLDOWN' }, HttpStatus.TOO_MANY_REQUESTS);
    }

    return { dedupeKey };
  }

  async rollbackSlots(reporterDiscordId: string, guildId?: string | null): Promise<void> {
    if (!this.redis.raw) return;
    const cooldownRedisKey = `report:cooldown:${reporterDiscordId}:${guildId ?? 'global'}`;
    await this.redis.raw.del(cooldownRedisKey);
    const dayKey = `reports:reporter:${reporterDiscordId}:day`;
    await this.redis.raw.decr(dayKey);
  }
}
