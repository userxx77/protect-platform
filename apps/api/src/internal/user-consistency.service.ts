import { Injectable } from '@nestjs/common';
import { FlagPolicyService } from '../domain/flag-policy.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { userToPublic } from '../users/user.mapper';

const userRedisKey = (discordId: string) => `user:${discordId}`;

export type UserConsistencyResult = {
  aligned: boolean;
  issues: string[];
  snapshot: {
    discordId: string;
    db: {
      flagScore: number;
      flagLevel: string;
      flagCount: number;
      stateVersion?: number;
    };
    expectedFromFlags: {
      score: number;
      level: string;
    };
    redisCache: {
      present: boolean;
      matchesDbPublic: boolean | null;
      cached?: { flagScore: number; flagLevel: string; flagCount?: number };
    };
  };
};

@Injectable()
export class UserConsistencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: FlagPolicyService,
    private readonly redis: RedisService,
    private readonly users: UsersService,
  ) {}

  async validate(discordId: string): Promise<UserConsistencyResult> {
    const issues: string[] = [];
    const user = await this.prisma.user.findUnique({
      where: { discordId },
      include: { flags: true },
    });

    if (!user) {
      return {
        aligned: true,
        issues: [],
        snapshot: {
          discordId,
          db: { flagScore: 0, flagLevel: 'CLEAN', flagCount: 0, stateVersion: 0 },
          expectedFromFlags: { score: 0, level: 'CLEAN' },
          redisCache: { present: false, matchesDbPublic: null },
        },
      };
    }

    let expectedScore = 0;
    for (const f of user.flags) {
      expectedScore += f.effectiveWeight ?? f.weight;
    }
    const expectedLevel = this.policy.levelFromScore(expectedScore);

    if (user.flagScore !== expectedScore) {
      issues.push(
        `db.flagScore (${user.flagScore}) !== sum(effectiveWeights) (${expectedScore})`,
      );
    }
    if (user.flagLevel !== expectedLevel) {
      issues.push(
        `db.flagLevel (${user.flagLevel}) !== levelFromScore(expectedScore) (${expectedLevel})`,
      );
    }

    const dbPublic = userToPublic(user, user.flags.length);
    let redisCache: UserConsistencyResult['snapshot']['redisCache'] = {
      present: false,
      matchesDbPublic: null,
    };

    const raw = this.redis.raw;
    if (raw) {
      const cached = await raw.get(userRedisKey(discordId));
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as {
            flagScore: number;
            flagLevel: string;
            flagCount?: number;
            stateVersion?: number;
          };
          const matchPub =
            parsed.flagScore === dbPublic.flagScore &&
            parsed.flagLevel === dbPublic.flagLevel &&
            (parsed.flagCount ?? 0) === (dbPublic.flagCount ?? 0) &&
            (parsed.stateVersion ?? 0) === (dbPublic.stateVersion ?? 0);
          if (!matchPub) {
            issues.push('redis user cache JSON does not match DB-derived public shape');
          }
          redisCache = {
            present: true,
            matchesDbPublic: matchPub,
            cached: {
              flagScore: parsed.flagScore,
              flagLevel: parsed.flagLevel,
              flagCount: parsed.flagCount,
            },
          };
        } catch {
          issues.push('redis user cache value is not valid JSON');
          redisCache = { present: true, matchesDbPublic: false };
        }
      }
    }

    return {
      aligned: issues.length === 0,
      issues,
      snapshot: {
        discordId,
        db: {
          flagScore: user.flagScore,
          flagLevel: user.flagLevel,
          flagCount: user.flags.length,
          stateVersion: user.stateVersion,
        },
        expectedFromFlags: {
          score: expectedScore,
          level: expectedLevel,
        },
        redisCache,
      },
    };
  }

  async repair(discordId: string): Promise<{ ok: boolean }> {
    await this.users.refreshPublicCache(discordId);
    return { ok: true };
  }
}
