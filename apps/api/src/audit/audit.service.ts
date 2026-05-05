import { Injectable } from '@nestjs/common';
import { AuditAction, ActorKind, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getCorrelationId } from '../common/correlation.context';

export type AuditListFilter = {
  limit: number;
  cursor?: string;
  action?: AuditAction;
  actorDiscordId?: string;
  targetId?: string;
  from?: Date;
  to?: Date;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    action: AuditAction;
    entityType: string;
    entityId: string;
    targetId?: string | null;
    actorDiscordId?: string | null;
    actorKind?: ActorKind;
    correlationId?: string | null;
    metadata?: Prisma.JsonValue;
  }) {
    const correlationId = input.correlationId ?? getCorrelationId();
    await this.prisma.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        targetId: input.targetId ?? undefined,
        actorDiscordId: input.actorDiscordId ?? undefined,
        actorKind: input.actorKind ?? ActorKind.USER,
        correlationId: correlationId ?? undefined,
        metadata: input.metadata ?? {},
      },
    });
  }

  /** Write audit row inside an open Prisma transaction (same atomicity as domain writes). */
  async logWithTx(
    tx: Prisma.TransactionClient,
    input: {
      action: AuditAction;
      entityType: string;
      entityId: string;
      targetId?: string | null;
      actorDiscordId?: string | null;
      actorKind?: ActorKind;
      correlationId?: string | null;
      metadata?: Prisma.JsonValue;
    },
  ) {
    const correlationId = input.correlationId ?? getCorrelationId();
    await tx.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        targetId: input.targetId ?? undefined,
        actorDiscordId: input.actorDiscordId ?? undefined,
        actorKind: input.actorKind ?? ActorKind.USER,
        correlationId: correlationId ?? undefined,
        metadata: input.metadata ?? {},
      },
    });
  }

  async list(filter: AuditListFilter) {
    const take = filter.limit + 1;
    const where: Prisma.AuditLogWhereInput = {
      ...(filter.action ? { action: filter.action } : {}),
      ...(filter.actorDiscordId ? { actorDiscordId: filter.actorDiscordId } : {}),
      ...(filter.targetId ? { targetId: filter.targetId } : {}),
      ...(
        filter.from || filter.to
          ? {
              timestamp: {
                ...(filter.from ? { gte: filter.from } : {}),
                ...(filter.to ? { lte: filter.to } : {}),
              },
            }
          : {}
      ),
    };

    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take,
      ...(filter.cursor
        ? { cursor: { id: filter.cursor }, skip: 1 }
        : {}),
    });

    let nextCursor: string | undefined;
    let list = rows;
    if (rows.length > filter.limit) {
      const next = rows[filter.limit];
      nextCursor = next?.id;
      list = rows.slice(0, filter.limit);
    }
    return { items: list, nextCursor };
  }
}
