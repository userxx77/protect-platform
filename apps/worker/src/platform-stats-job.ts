import type { PrismaClient } from '@prisma/client';
import { FlagLevel } from '@prisma/client';
import { logWorker } from './log';

const SNAPSHOT_ID = 'default';

export async function runPlatformStatsRefresh(prisma: PrismaClient): Promise<void> {
  const [guildsActive, distinctRows, usersFlagged] = await Promise.all([
    prisma.server.count({ where: { removedAt: null } }),
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT discord_user_id) AS count FROM guild_member_cache
    `,
    prisma.user.count({
      where: { flagLevel: { not: FlagLevel.CLEAN } },
    }),
  ]);
  const trackedMemberDistinct = Number(distinctRows[0]?.count ?? 0);

  await prisma.platformStatsSnapshot.update({
    where: { id: SNAPSHOT_ID },
    data: {
      guildsActive,
      trackedMemberDistinct,
      usersFlagged,
    },
  });
}

export async function runPlatformStatsRefreshSafe(prisma: PrismaClient): Promise<void> {
  try {
    await runPlatformStatsRefresh(prisma);
  } catch (e) {
    logWorker('warn', 'platform_stats_refresh_failed', {
      error: String(e).slice(0, 400),
    });
  }
}
