import type { PrismaClient } from '@prisma/client';
import { LicenseStatus, Prisma } from '@prisma/client';
import { logWorker } from './log';

function activeLicenseWhere(now: Date): Prisma.GuildEntitlementWhereInput {
  return {
    status: { in: [LicenseStatus.TRIAL, LicenseStatus.ACTIVE] },
    validFrom: { lte: now },
    OR: [{ validUntil: null }, { validUntil: { gte: now } }],
  };
}

/**
 * Enqueues `guild.members.sync` outbox rows for all currently licensed guilds,
 * at most once per scheduler bucket (see intervalMs), so the bot refreshes member cache periodically.
 */
export async function runMemberSyncSchedule(
  prisma: PrismaClient,
  intervalMs: number,
): Promise<{ enqueued: number; skipped: number }> {
  if (intervalMs <= 0) {
    return { enqueued: 0, skipped: 0 };
  }

  const now = new Date();
  const bucket = Math.floor(Date.now() / intervalMs);
  const guilds = await prisma.guildEntitlement.findMany({
    where: activeLicenseWhere(now),
    select: { guildId: true },
  });

  let enqueued = 0;
  let skipped = 0;

  for (const { guildId } of guilds) {
    const idempotencyKey = `guild.members.sync:scheduled:${guildId}:${bucket}`;
    try {
      await prisma.outboxEvent.create({
        data: {
          type: 'guild.members.sync',
          payload: { guildId } as Prisma.InputJsonValue,
          idempotencyKey,
        },
      });
      enqueued += 1;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        skipped += 1;
        continue;
      }
      logWorker('warn', 'member_sync_schedule_enqueue_failed', {
        guildId,
        error: String(e).slice(0, 400),
      });
    }
  }

  if (enqueued > 0) {
    logWorker('info', 'member_sync_schedule_enqueued', {
      enqueued,
      skipped,
      guildCount: guilds.length,
      bucket,
    });
  }

  return { enqueued, skipped };
}
