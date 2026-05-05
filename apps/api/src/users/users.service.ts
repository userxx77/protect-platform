import { Injectable } from '@nestjs/common';
import { FlagLevel, Prisma } from '@prisma/client';
import type { UserPublic } from '@protect/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UserCacheService } from '../cache/user-cache.service';
import { userToPublic } from './user.mapper';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: UserCacheService,
  ) {}

  async getOrCreate(discordId: string) {
    return this.prisma.user.upsert({
      where: { discordId },
      create: { discordId, flagScore: 0, flagLevel: FlagLevel.CLEAN },
      update: {},
    });
  }

  async getPublicByDiscordId(
    discordId: string,
    options?: { skipCache?: boolean },
  ): Promise<UserPublic> {
    if (!options?.skipCache) {
      const cached = await this.cache.get(discordId);
      if (cached) {
        return cached;
      }
      if (await this.cache.getNegativeMarker(discordId)) {
        return {
          discordId,
          flagScore: 0,
          flagLevel: FlagLevel.CLEAN,
          flagCount: 0,
          updatedAt: new Date().toISOString(),
        };
      }
    }
    const user = await this.prisma.user.findUnique({
      where: { discordId },
      include: { _count: { select: { flags: true } } },
    });
    if (!user) {
      if (!options?.skipCache) {
        await this.cache.setNegativeMarker(discordId);
      }
      return {
        discordId,
        flagScore: 0,
        flagLevel: FlagLevel.CLEAN,
        flagCount: 0,
        updatedAt: new Date().toISOString(),
      };
    }
    const pub = userToPublic(user, user._count.flags);
    if (!options?.skipCache) {
      await this.cache.setAuthoritative(discordId, pub);
    }
    return pub;
  }

  async refreshPublicCache(discordId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { discordId },
      include: { _count: { select: { flags: true } } },
    });
    if (!user) {
      await this.cache.invalidate(discordId);
      return;
    }
    const pub = userToPublic(user, user._count.flags);
    await this.cache.setAuthoritative(discordId, pub);
  }

  async invalidateAndRefreshCache(discordId: string): Promise<void> {
    await this.refreshPublicCache(discordId);
  }

  async listFlagged(input: {
    level?: FlagLevel;
    cursor?: string;
    limit: number;
  }) {
    const where: Prisma.UserWhereInput = {
      flagLevel: { not: FlagLevel.CLEAN },
      ...(input.level ? { flagLevel: input.level } : {}),
    };
    const take = input.limit + 1;
    const users = await this.prisma.user.findMany({
      where,
      orderBy: [{ flagLevel: 'desc' }, { updatedAt: 'desc' }],
      take,
      ...(input.cursor
        ? {
            cursor: { id: input.cursor },
            skip: 1,
          }
        : {}),
      include: { _count: { select: { flags: true } } },
    });
    let nextCursor: string | undefined;
    let list = users;
    if (users.length > input.limit) {
      const next = users[input.limit];
      nextCursor = next?.id;
      list = users.slice(0, input.limit);
    }
    return {
      items: list.map((u) => userToPublic(u, u._count.flags)),
      nextCursor,
    };
  }
}
