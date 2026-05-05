import { Injectable } from '@nestjs/common';
import { AuditAction, ActorKind, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpsertServerConfigDto } from './dto/server-config.dto';
import { OutboxService } from '../events/outbox.service';

@Injectable()
export class ServersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  async getByGuildId(guildId: string) {
    const row = await this.prisma.server.findUnique({ where: { guildId } });
    return {
      guildId,
      config: (row?.config ?? {}) as Prisma.JsonObject,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
    };
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
}
