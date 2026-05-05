import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditAction, ActorKind, LicenseStatus, MemberSyncState, Prisma } from '@prisma/client';
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

  /** Called by bot on guild join/leave — creates INACTIVE entitlement row for new guilds. */
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
        await tx.guildEntitlement.create({
          data: {
            guildId: dto.guildId,
            status: LicenseStatus.INACTIVE,
            validFrom: new Date(),
          },
        });
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

  async markMemberSyncIdle(guildId: string): Promise<void> {
    await this.prisma.guildEntitlement.updateMany({
      where: { guildId },
      data: {
        memberSyncState: MemberSyncState.IDLE,
        lastMemberSyncAt: new Date(),
      },
    });
  }
}
