import { Injectable } from '@nestjs/common';
import { FlagLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const SNAPSHOT_ID = 'default';

export type PlatformStatsPublic = {
  guildsActive: number;
  trackedMemberDistinct: number;
  usersFlagged: number;
  manualChecksTotal: number;
  updatedAt: string;
};

@Injectable()
export class PlatformStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async refreshAggregates(): Promise<void> {
    const [guildsActive, distinctRows, usersFlagged] = await Promise.all([
      this.prisma.server.count({ where: { removedAt: null } }),
      this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT discord_user_id) AS count FROM guild_member_cache
      `,
      this.prisma.user.count({
        where: { flagLevel: { not: FlagLevel.CLEAN } },
      }),
    ]);
    const trackedMemberDistinct = Number(distinctRows[0]?.count ?? 0);

    await this.prisma.platformStatsSnapshot.update({
      where: { id: SNAPSHOT_ID },
      data: {
        guildsActive,
        trackedMemberDistinct,
        usersFlagged,
      },
    });
  }

  async incrementManualChecks(): Promise<void> {
    try {
      await this.prisma.platformStatsSnapshot.update({
        where: { id: SNAPSHOT_ID },
        data: { manualChecksTotal: { increment: 1 } },
      });
    } catch {
      await this.prisma.platformStatsSnapshot.upsert({
        where: { id: SNAPSHOT_ID },
        create: {
          id: SNAPSHOT_ID,
          guildsActive: 0,
          trackedMemberDistinct: 0,
          usersFlagged: 0,
          manualChecksTotal: 1,
        },
        update: { manualChecksTotal: { increment: 1 } },
      });
    }
  }

  async getPublicSnapshot(): Promise<PlatformStatsPublic> {
    const row = await this.prisma.platformStatsSnapshot.findUnique({
      where: { id: SNAPSHOT_ID },
    });
    if (row) {
      return {
        guildsActive: row.guildsActive,
        trackedMemberDistinct: row.trackedMemberDistinct,
        usersFlagged: row.usersFlagged,
        manualChecksTotal: row.manualChecksTotal,
        updatedAt: row.updatedAt.toISOString(),
      };
    }
    await this.refreshAggregates().catch(() => undefined);
    const again = await this.prisma.platformStatsSnapshot.findUnique({
      where: { id: SNAPSHOT_ID },
    });
    if (again) {
      return {
        guildsActive: again.guildsActive,
        trackedMemberDistinct: again.trackedMemberDistinct,
        usersFlagged: again.usersFlagged,
        manualChecksTotal: again.manualChecksTotal,
        updatedAt: again.updatedAt.toISOString(),
      };
    }
    return {
      guildsActive: 0,
      trackedMemberDistinct: 0,
      usersFlagged: 0,
      manualChecksTotal: 0,
      updatedAt: new Date().toISOString(),
    };
  }
}
