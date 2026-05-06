import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { AuditAction, ActorKind, FlagLevel, FlagSource } from '@prisma/client';
import { AppRole, type RequestPrincipal } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { FlagPolicyService } from '../domain/flag-policy.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../events/outbox.service';
import { lockUserRowForAggregateUpdate } from '../prisma/user-row-lock';
import { CreateFlagDto } from './dto/create-flag.dto';

@Injectable()
export class FlagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: FlagPolicyService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  async createFlag(dto: CreateFlagDto, principal: RequestPrincipal) {
    const actorDiscordId =
      principal.identity.kind === 'user'
        ? principal.identity.discordId
        : dto.actorDiscordId;

    if (dto.actorDiscordId !== actorDiscordId && principal.identity.kind === 'user') {
      throw new BadRequestException('actorDiscordId must match authenticated user');
    }

    if (actorDiscordId === dto.targetDiscordId) {
      throw new BadRequestException('Cannot flag yourself');
    }

    const useAdminOverride =
      dto.adminOverride === true &&
      principal.identity.kind === 'user' &&
      principal.roles.includes(AppRole.ADMIN);

    if (dto.adminOverride && !useAdminOverride) {
      throw new ForbiddenException('adminOverride requires ADMIN session');
    }

    if (principal.identity.kind === 'bot' && !useAdminOverride && dto.severity == null) {
      throw new BadRequestException('severity is required');
    }

    let weight: number;
    let source: FlagSource;

    if (useAdminOverride) {
      weight = this.policy.adminOverrideWeight();
      source = FlagSource.ADMIN_OVERRIDE;
    } else {
      const trusted = await this.prisma.trustedUser.findUnique({
        where: { discordUserId: actorDiscordId },
      });
      if (!trusted) {
        throw new ForbiddenException('Actor is not a trusted user');
      }
      weight =
        dto.severity != null
          ? this.policy.trustedCommandWeightForSeverity(dto.severity)
          : this.policy.flagWeightFromTrustLevel(trusted.trustLevel);
      source = FlagSource.TRUSTED_COMMAND;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const targetUser = await tx.user.upsert({
        where: { discordId: dto.targetDiscordId },
        create: {
          discordId: dto.targetDiscordId,
          flagScore: 0,
          flagLevel: FlagLevel.CLEAN,
        },
        update: {},
      });

      await lockUserRowForAggregateUpdate(tx, targetUser.id);

      const createdFlag = await tx.flag.create({
        data: {
          userId: targetUser.id,
          weight,
          effectiveWeight: weight,
          reason: dto.reason,
          source,
          actorDiscordId,
          guildId: dto.guildId ?? null,
        },
      });

      await tx.user.update({
        where: { id: targetUser.id },
        data: { flagScore: { increment: weight } },
      });

      const afterScore = await tx.user.findUniqueOrThrow({
        where: { id: targetUser.id },
      });
      const nextLevel = this.policy.levelFromScore(afterScore.flagScore);

      const saved = await tx.user.update({
        where: { id: targetUser.id },
        data: {
          flagLevel: nextLevel,
          stateVersion: { increment: 1 },
        },
      });

      await this.audit.logWithTx(tx, {
        action: AuditAction.FLAG_CREATED,
        entityType: 'user',
        entityId: saved.discordId,
        targetId: dto.targetDiscordId,
        actorDiscordId,
        actorKind:
          principal.identity.kind === 'bot' ? ActorKind.BOT : ActorKind.USER,
        metadata: {
          weight,
          source,
          guildId: dto.guildId,
          adminOverride: useAdminOverride,
        },
      });

      await this.outbox.enqueueMany(tx, [
        {
          type: 'user.flagged',
          idempotencyKey: `user.flagged:${createdFlag.id}`,
          payload: {
            targetDiscordId: dto.targetDiscordId,
            flagLevel: saved.flagLevel,
            flagScore: saved.flagScore,
            guildId: dto.guildId ?? null,
            actorDiscordId,
            stateVersion: saved.stateVersion,
          },
        },
        {
          type: 'user.updated',
          idempotencyKey: `user.updated:${targetUser.id}:flag:${createdFlag.id}`,
          payload: {
            discordId: dto.targetDiscordId,
            flagLevel: saved.flagLevel,
            flagScore: saved.flagScore,
            stateVersion: saved.stateVersion,
          },
        },
      ]);

      return { saved, weight, source };
    });

    await this.users.invalidateAndRefreshCache(dto.targetDiscordId);

    return {
      discordId: updated.saved.discordId,
      flagScore: updated.saved.flagScore,
      flagLevel: updated.saved.flagLevel,
      weightApplied: updated.weight,
      source: updated.source,
    };
  }
}
