import type { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';

/** Mirrors Prisma `FlagLevel` (avoid separate client generate in worker). */
type FlagLevelStr =
  | 'CLEAN'
  | 'SUSPICIOUS'
  | 'HIGH_RISK'
  | 'CONFIRMED_CHEATER';

type Thresholds = {
  suspicious: number;
  highRisk: number;
  confirmed: number;
};

function parseMultMap(raw: string | undefined): Record<string, number> {
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

function levelFromScore(score: number, t: Thresholds): FlagLevelStr {
  if (score >= t.confirmed) return 'CONFIRMED_CHEATER';
  if (score >= t.highRisk) return 'HIGH_RISK';
  if (score >= t.suspicious) return 'SUSPICIOUS';
  return 'CLEAN';
}

function effectiveWeightForFlag(
  source: string,
  weight: number,
  createdAt: Date,
  nowMs: number,
  halfLifeDays: number,
  multMap: Record<string, number>,
): number {
  if (source === 'ADMIN_OVERRIDE') {
    return weight;
  }
  if (halfLifeDays <= 0) {
    return weight;
  }
  const ageDays = (nowMs - createdAt.getTime()) / 86_400_000;
  const m = multMap[source] ?? 1;
  const factor = Math.pow(2, (-ageDays * m) / halfLifeDays);
  return Math.max(0, Math.floor(weight * factor));
}

const userCacheKey = (discordId: string) => `user:${discordId}`;
const negCacheKey = (discordId: string) => `user:neg:${discordId}`;

export async function runDecayJob(
  prisma: PrismaClient,
  redis: Redis,
): Promise<void> {
  if (process.env.FLAG_DECAY_ENABLED !== 'true') {
    return;
  }

  const halfLifeDays = Number(process.env.FLAG_DECAY_HALF_LIFE_DAYS ?? 30);
  const multMap = parseMultMap(process.env.FLAG_DECAY_SOURCE_MULTIPLIERS);
  const thresholds: Thresholds = {
    suspicious: Number(process.env.FLAG_THRESHOLD_SUSPICIOUS ?? 1),
    highRisk: Number(process.env.FLAG_THRESHOLD_HIGH_RISK ?? 10),
    confirmed: Number(process.env.FLAG_THRESHOLD_CONFIRMED ?? 25),
  };

  const nowMs = Date.now();
  const distinctUsers = await prisma.$queryRaw<{ user_id: string }[]>`
    SELECT DISTINCT "user_id" FROM flags
  `;

  for (const row of distinctUsers) {
    let discordId: string | undefined;
    let didMutate = false;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$executeRawUnsafe(
        'SELECT 1 FROM users WHERE id = $1::uuid FOR UPDATE',
        row.user_id,
      );

      const user = await tx.user.findUnique({
        where: { id: row.user_id },
        include: { flags: true },
      });
      if (!user || user.flags.length === 0) {
        return;
      }

      discordId = user.discordId;

      let sum = 0;
      const updates: { id: string; effectiveWeight: number }[] = [];
      for (const f of user.flags) {
        const ew = effectiveWeightForFlag(
          f.source,
          f.weight,
          f.createdAt,
          nowMs,
          halfLifeDays,
          multMap,
        );
        updates.push({ id: f.id, effectiveWeight: ew });
        sum += ew;
      }

      const nextLevel = levelFromScore(sum, thresholds);
      const anyEwChanged = updates.some((u) => {
        const f = user.flags.find(
          (x: (typeof user.flags)[number]) => x.id === u.id,
        );
        if (!f) return true;
        const prev = f.effectiveWeight ?? f.weight;
        return prev !== u.effectiveWeight;
      });

      if (
        sum === user.flagScore &&
        !anyEwChanged &&
        nextLevel === user.flagLevel
      ) {
        return;
      }

      didMutate = true;
      for (const u of updates) {
        await tx.flag.update({
          where: { id: u.id },
          data: { effectiveWeight: u.effectiveWeight },
        });
      }

      const saved = await tx.user.update({
        where: { id: user.id },
        data: {
          flagScore: sum,
          flagLevel: nextLevel as typeof user.flagLevel,
          stateVersion: { increment: 1 },
        },
      });

      await tx.outboxEvent.create({
        data: {
          type: 'user.updated',
          payload: {
            discordId: user.discordId,
            flagLevel: nextLevel,
            flagScore: sum,
            stateVersion: saved.stateVersion,
          },
          idempotencyKey: `user.updated:decay:${user.id}:${nowMs}`,
        },
      });
    });

    if (didMutate && discordId) {
      await redis.del(userCacheKey(discordId), negCacheKey(discordId));
    }
  }
}
