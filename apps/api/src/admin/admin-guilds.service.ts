import { Injectable } from '@nestjs/common';
import { AuditAction, ActorKind, LicenseStatus, MemberSyncState } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { OutboxService } from '../events/outbox.service';
import { AuditService } from '../audit/audit.service';
import type { UpsertEntitlementBodyDto } from '../admin/dto/admin-guilds.dto';

@Injectable()
export class AdminGuildsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  async listGuilds() {
    const rows = await this.prisma.server.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { entitlement: true },
    });
    return rows.map((r) => ({
      guildId: r.guildId,
      discordName: r.discordName,
      iconHash: r.iconHash,
      approximateMemberCount: r.approximateMemberCount,
      ownerDiscordId: r.ownerDiscordId,
      vanityUrlCode: r.vanityUrlCode,
      premiumTier: r.premiumTier,
      botJoinedAt: r.botJoinedAt?.toISOString() ?? null,
      removedAt: r.removedAt?.toISOString() ?? null,
      updatedAt: r.updatedAt.toISOString(),
      entitlement: r.entitlement
        ? {
            status: r.entitlement.status,
            validFrom: r.entitlement.validFrom.toISOString(),
            validUntil: r.entitlement.validUntil?.toISOString() ?? null,
            planCode: r.entitlement.planCode,
            memberSyncState: r.entitlement.memberSyncState,
            lastMemberSyncAt: r.entitlement.lastMemberSyncAt?.toISOString() ?? null,
          }
        : null,
    }));
  }

  async upsertEntitlement(
    guildId: string,
    dto: UpsertEntitlementBodyDto,
    actorDiscordId: string,
  ) {
    await this.prisma.server.upsert({
      where: { guildId },
      create: { guildId },
      update: {},
    });

    const validFrom = new Date(dto.validFrom);
    const validUntil =
      dto.validUntil === undefined || dto.validUntil === null || dto.validUntil === ''
        ? null
        : new Date(dto.validUntil);

    await this.entitlements.upsertEntitlement({
      guildId,
      status: dto.status,
      validFrom,
      validUntil,
      planCode: dto.planCode,
      stripeCustomerId: dto.stripeCustomerId,
      stripeSubscriptionId: dto.stripeSubscriptionId,
      createdByDiscordId: actorDiscordId,
    });

    await this.audit.log({
      action: AuditAction.ENTITLEMENT_UPDATED,
      entityType: 'guild_entitlement',
      entityId: guildId,
      targetId: guildId,
      actorDiscordId,
      actorKind: ActorKind.USER,
      metadata: {
        status: dto.status,
        validFrom: validFrom.toISOString(),
        validUntil: validUntil?.toISOString() ?? null,
      },
    });

    return { guildId, ok: true as const };
  }

  async requestMemberSync(guildId: string): Promise<{ ok: true }> {
    const ent = await this.prisma.guildEntitlement.findUnique({
      where: { guildId },
    });
    if (!ent) {
      await this.prisma.server.upsert({
        where: { guildId },
        create: { guildId },
        update: {},
      });
      await this.prisma.guildEntitlement.create({
        data: {
          guildId,
          status: LicenseStatus.INACTIVE,
          validFrom: new Date(),
          memberSyncState: MemberSyncState.QUEUED,
        },
      });
    } else {
      await this.prisma.guildEntitlement.update({
        where: { guildId },
        data: { memberSyncState: MemberSyncState.QUEUED },
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await this.outbox.enqueue(tx, {
        type: 'guild.members.sync',
        idempotencyKey: `guild.members.sync:${guildId}:${Date.now()}`,
        payload: { guildId },
      });
    });

    return { ok: true as const };
  }

  async requestMetadataRefresh(guildId: string): Promise<{ ok: true }> {
    await this.prisma.$transaction(async (tx) => {
      await this.outbox.enqueue(tx, {
        type: 'guild.metadata.refresh',
        idempotencyKey: `guild.metadata.refresh:${guildId}:${Date.now()}`,
        payload: { guildId },
      });
    });
    return { ok: true as const };
  }
}
