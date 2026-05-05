import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ActorKind, AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FlagPolicyService } from '../domain/flag-policy.service';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../events/outbox.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AdminFlagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: FlagPolicyService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly users: UsersService,
  ) {}

  private effectiveWeight(f: { weight: number; effectiveWeight: number | null }): number {
    return f.effectiveWeight ?? f.weight;
  }

  private async recomputeUser(tx: Prisma.TransactionClient, userId: string) {
    const flags = await tx.flag.findMany({ where: { userId } });
    const score = flags.reduce((s, f) => s + this.effectiveWeight(f), 0);
    const nextLevel = this.policy.levelFromScore(score);
    return tx.user.update({
      where: { id: userId },
      data: {
        flagScore: score,
        flagLevel: nextLevel,
        stateVersion: { increment: 1 },
      },
    });
  }

  async listForUser(targetDiscordId: string) {
    const user = await this.prisma.user.findUnique({
      where: { discordId: targetDiscordId },
      include: {
        flags: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      discordId: user.discordId,
      flagScore: user.flagScore,
      flagLevel: user.flagLevel,
      items: user.flags.map((f) => ({
        id: f.id,
        weight: f.weight,
        reason: f.reason,
        source: f.source,
        actorDiscordId: f.actorDiscordId,
        guildId: f.guildId,
        createdAt: f.createdAt.toISOString(),
      })),
    };
  }

  async deleteFlag(actorDiscordId: string, targetDiscordId: string, flagId: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { discordId: targetDiscordId } });
      if (!user) throw new NotFoundException('User not found');
      const flag = await tx.flag.findFirst({
        where: { id: flagId, userId: user.id },
      });
      if (!flag) throw new NotFoundException('Flag not found');
      await tx.flag.delete({ where: { id: flagId } });
      const userAfter = await this.recomputeUser(tx, user.id);

      await this.audit.logWithTx(tx, {
        action: AuditAction.FLAG_DELETED,
        entityType: 'flag',
        entityId: flagId,
        targetId: targetDiscordId,
        actorDiscordId,
        actorKind: ActorKind.USER,
        metadata: { previousWeight: flag.weight },
      });

      await this.outbox.enqueueMany(tx, [
        {
          type: 'flag.removed',
          idempotencyKey: `flag.removed:${flagId}`,
          payload: {
            discordId: targetDiscordId,
            flagId,
            actorDiscordId,
          },
        },
        {
          type: 'user.updated',
          idempotencyKey: `user.updated:${user.id}:flag_deleted:${flagId}`,
          payload: {
            discordId: targetDiscordId,
            flagLevel: userAfter.flagLevel,
            flagScore: userAfter.flagScore,
            stateVersion: userAfter.stateVersion,
          },
        },
      ]);

      return userAfter;
    });

    await this.users.invalidateAndRefreshCache(targetDiscordId);
    return {
      discordId: updated.discordId,
      flagScore: updated.flagScore,
      flagLevel: updated.flagLevel,
    };
  }

  async patchFlag(
    actorDiscordId: string,
    targetDiscordId: string,
    flagId: string,
    body: { reason?: string; weight?: number },
  ) {
    if (body.reason === undefined && body.weight === undefined) {
      throw new BadRequestException('No changes');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { discordId: targetDiscordId } });
      if (!user) throw new NotFoundException('User not found');
      const flag = await tx.flag.findFirst({
        where: { id: flagId, userId: user.id },
      });
      if (!flag) throw new NotFoundException('Flag not found');

      await tx.flag.update({
        where: { id: flagId },
        data: {
          ...(body.reason !== undefined ? { reason: body.reason } : {}),
          ...(body.weight !== undefined
            ? { weight: body.weight, effectiveWeight: body.weight }
            : {}),
        },
      });

      const userAfter = await this.recomputeUser(tx, user.id);

      await this.audit.logWithTx(tx, {
        action: AuditAction.FLAG_UPDATED,
        entityType: 'flag',
        entityId: flagId,
        targetId: targetDiscordId,
        actorDiscordId,
        actorKind: ActorKind.USER,
        metadata: {
          reason: body.reason !== undefined,
          weight: body.weight !== undefined,
        },
      });

      await this.outbox.enqueue(tx, {
        type: 'user.updated',
        idempotencyKey: `user.updated:${user.id}:flag_patch:${flagId}`,
        payload: {
          discordId: targetDiscordId,
          flagLevel: userAfter.flagLevel,
          flagScore: userAfter.flagScore,
          stateVersion: userAfter.stateVersion,
        },
      });

      return userAfter;
    });

    await this.users.invalidateAndRefreshCache(targetDiscordId);
    return {
      discordId: updated.discordId,
      flagScore: updated.flagScore,
      flagLevel: updated.flagLevel,
    };
  }
}
