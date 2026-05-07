import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AuditAction, ActorKind, FlagLevel, LicenseStatus, MemberSyncState, Prisma } from '@prisma/client';
import { shouldAlertUserLevel } from '@protect/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpsertServerConfigDto } from './dto/server-config.dto';
import { OutboxService } from '../events/outbox.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

export type GuildMemberBatchRow = {
  discordUserId: string;
  username?: string | null;
  globalName?: string | null;
  avatarHash?: string | null;
};

@Injectable()
export class ServersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly entitlements: EntitlementsService,
    private readonly config: ConfigService,
  ) {}

  async getByGuildId(guildId: string) {
    const row = await this.prisma.server.findUnique({ where: { guildId } });
    return {
      guildId,
      config: (row?.config ?? {}) as Prisma.JsonObject,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
    };
  }

  async listSummaries() {
    const rows = await this.prisma.server.findMany({
      orderBy: { updatedAt: 'desc' },
      select: { guildId: true, config: true, updatedAt: true },
    });
    return rows.map((r) => {
      const cfg = (r.config ?? {}) as Record<string, unknown>;
      return {
        guildId: r.guildId,
        updatedAt: r.updatedAt.toISOString(),
        alertChannelId:
          typeof cfg.alertChannelId === 'string' ? cfg.alertChannelId : null,
        alertMinLevel:
          typeof cfg.alertMinLevel === 'string' ? cfg.alertMinLevel : null,
        joinHoldEnabled:
          typeof cfg.joinHoldEnabled === 'boolean' ? cfg.joinHoldEnabled : null,
        joinHoldDurationMinutes:
          typeof cfg.joinHoldDurationMinutes === 'number'
            ? cfg.joinHoldDurationMinutes
            : null,
        joinHoldMinLevel:
          typeof cfg.joinHoldMinLevel === 'string' ? cfg.joinHoldMinLevel : null,
        joinActionPolicy:
          typeof cfg.joinActionPolicy === 'string' ? cfg.joinActionPolicy : null,
      };
    });
  }

  async upsertConfig(
    dto: UpsertServerConfigDto,
    actorDiscordId: string,
    actorKind: ActorKind,
  ) {
    const existing = await this.prisma.server.findUnique({ where: { guildId: dto.guildId } });
    const prev = (existing?.config ?? {}) as Record<string, unknown>;
    const next = { ...prev, ...dto.config } as Prisma.JsonObject;

    const saved = await this.prisma.$transaction(async (tx) => {
      const row = await tx.server.upsert({
        where: { guildId: dto.guildId },
        create: { guildId: dto.guildId, config: next },
        update: { config: next },
      });

      await this.audit.logWithTx(tx, {
        action: AuditAction.SERVER_CONFIG_UPDATED,
        entityType: 'server',
        entityId: dto.guildId,
        targetId: dto.guildId,
        actorDiscordId: actorKind === ActorKind.BOT ? undefined : actorDiscordId,
        actorKind,
        metadata: { config: next },
      });

      await this.outbox.enqueue(tx, {
        type: 'server.config.updated',
        idempotencyKey: `server.config.updated:${row.id}:${row.updatedAt.toISOString()}`,
        payload: { guildId: dto.guildId },
      });

      return row;
    });

    return {
      guildId: saved.guildId,
      config: saved.config as Prisma.JsonObject,
      updatedAt: saved.updatedAt.toISOString(),
    };
  }

  /** Bot: upsert Discord server metadata only (no entitlement / lifecycle side effects). */
  async recordBotGuildSnapshot(dto: {
    guildId: string;
    discordName?: string | null;
    iconHash?: string | null;
    approximateMemberCount?: number | null;
    ownerDiscordId?: string | null;
    vanityUrlCode?: string | null;
    premiumTier?: number | null;
  }): Promise<void> {
    await this.prisma.server.upsert({
      where: { guildId: dto.guildId },
      create: {
        guildId: dto.guildId,
        discordName: dto.discordName ?? null,
        iconHash: dto.iconHash ?? null,
        approximateMemberCount: dto.approximateMemberCount ?? null,
        ownerDiscordId: dto.ownerDiscordId ?? null,
        vanityUrlCode: dto.vanityUrlCode ?? null,
        premiumTier: dto.premiumTier ?? null,
      },
      update: {
        discordName: dto.discordName ?? undefined,
        iconHash: dto.iconHash ?? undefined,
        approximateMemberCount: dto.approximateMemberCount ?? undefined,
        ownerDiscordId: dto.ownerDiscordId ?? undefined,
        vanityUrlCode: dto.vanityUrlCode ?? undefined,
        premiumTier: dto.premiumTier ?? undefined,
      },
    });
  }

  /** Called by bot on guild join/leave — creates entitlement (auto-trial or INACTIVE). */
  async recordBotGuildLifecycle(dto: {
    guildId: string;
    discordName?: string | null;
    iconHash?: string | null;
    approximateMemberCount?: number | null;
    ownerDiscordId?: string | null;
    vanityUrlCode?: string | null;
    premiumTier?: number | null;
    event: 'join' | 'leave';
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const removedAt = dto.event === 'leave' ? new Date() : null;

      await tx.server.upsert({
        where: { guildId: dto.guildId },
        create: {
          guildId: dto.guildId,
          discordName: dto.discordName ?? null,
          iconHash: dto.iconHash ?? null,
          approximateMemberCount: dto.approximateMemberCount ?? null,
          ownerDiscordId: dto.ownerDiscordId ?? null,
          vanityUrlCode: dto.vanityUrlCode ?? null,
          premiumTier: dto.premiumTier ?? null,
          botJoinedAt: dto.event === 'join' ? new Date() : null,
          removedAt,
        },
        update: {
          discordName: dto.discordName ?? undefined,
          iconHash: dto.iconHash ?? undefined,
          approximateMemberCount: dto.approximateMemberCount ?? undefined,
          ownerDiscordId: dto.ownerDiscordId ?? undefined,
          vanityUrlCode: dto.vanityUrlCode ?? undefined,
          premiumTier: dto.premiumTier ?? undefined,
          ...(dto.event === 'join'
            ? { botJoinedAt: new Date(), removedAt: null }
            : { removedAt }),
        },
      });

      const ent = await tx.guildEntitlement.findUnique({
        where: { guildId: dto.guildId },
      });
      if (!ent) {
        const trialDays = Math.max(
          0,
          Math.min(
            3650,
            Number(this.config.get<string>('SENTRA_AUTO_TRIAL_DAYS') ?? 0) || 0,
          ),
        );
        const now = new Date();
        if (trialDays > 0) {
          const validUntil = new Date(now);
          validUntil.setUTCDate(validUntil.getUTCDate() + trialDays);
          await tx.guildEntitlement.create({
            data: {
              guildId: dto.guildId,
              status: LicenseStatus.TRIAL,
              validFrom: now,
              validUntil,
            },
          });
        } else {
          await tx.guildEntitlement.create({
            data: {
              guildId: dto.guildId,
              status: LicenseStatus.INACTIVE,
              validFrom: now,
            },
          });
        }
      }

      if (dto.event === 'join') {
        await this.audit.logWithTx(tx, {
          action: AuditAction.GUILD_DISCOVERED,
          entityType: 'server',
          entityId: dto.guildId,
          targetId: dto.guildId,
          actorKind: ActorKind.BOT,
          metadata: {
            name: dto.discordName,
            approximateMemberCount: dto.approximateMemberCount,
          },
        });

        await this.outbox.enqueue(tx, {
          type: 'guild.discovered',
          idempotencyKey: `guild.discovered:${dto.guildId}`,
          payload: {
            guildId: dto.guildId,
            name: dto.discordName ?? null,
            approximateMemberCount: dto.approximateMemberCount ?? null,
          },
        });
      }
    });
  }

  async batchUpsertGuildMembers(
    guildId: string,
    members: GuildMemberBatchRow[],
    source = 'SYNC',
  ): Promise<{ upserted: number }> {
    if (members.length === 0) return { upserted: 0 };

    const ent = await this.prisma.guildEntitlement.findUnique({
      where: { guildId },
      select: { memberSyncState: true },
    });
    if (ent?.memberSyncState === MemberSyncState.QUEUED) {
      await this.entitlements.setMemberSyncState(guildId, MemberSyncState.RUNNING);
    }

    let n = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const m of members) {
        await tx.guildMemberCache.upsert({
          where: {
            guildId_discordUserId: {
              guildId,
              discordUserId: m.discordUserId,
            },
          },
          create: {
            id: randomUUID(),
            guildId,
            discordUserId: m.discordUserId,
            username: m.username ?? null,
            globalName: m.globalName ?? null,
            avatarHash: m.avatarHash ?? null,
            source,
          },
          update: {
            username: m.username ?? null,
            globalName: m.globalName ?? null,
            avatarHash: m.avatarHash ?? null,
            source,
          },
        });
        n += 1;
      }
    });
    return { upserted: n };
  }

  async scanDiscordIdsAgainstAlertThreshold(
    discordIds: string[],
    alertMinLevel: string | undefined,
  ): Promise<
    Array<{
      discordId: string;
      flagLevel: FlagLevel;
      flagScore: number;
      flagCount: number;
    }>
  > {
    if (discordIds.length === 0) return [];
    const unique = [...new Set(discordIds)];
    const users = await this.prisma.user.findMany({
      where: { discordId: { in: unique } },
      include: { _count: { select: { flags: true } } },
    });
    return users
      .filter((u) => shouldAlertUserLevel(u.flagLevel, alertMinLevel))
      .map((u) => ({
        discordId: u.discordId,
        flagLevel: u.flagLevel,
        flagScore: u.flagScore,
        flagCount: u._count.flags,
      }));
  }

  async markMemberSyncIdle(guildId: string): Promise<void> {
    await this.prisma.guildEntitlement.updateMany({
      where: { guildId },
      data: {
        memberSyncState: MemberSyncState.IDLE,
        lastMemberSyncAt: new Date(),
      },
    });
  }

  async isGuildBlacklisted(guildId: string): Promise<boolean> {
    const row = await this.prisma.guildBlacklist.findUnique({
      where: { guildId },
      select: { guildId: true },
    });
    return row != null;
  }

  async addGuildBlacklist(
    guildId: string,
    createdByDiscordId: string,
    reason?: string,
  ): Promise<void> {
    await this.prisma.guildBlacklist.upsert({
      where: { guildId },
      create: {
        guildId,
        reason: reason ?? null,
        createdByDiscordId,
      },
      update: {
        reason: reason ?? null,
        createdByDiscordId,
      },
    });
  }
}
