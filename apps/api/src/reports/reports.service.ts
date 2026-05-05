import {
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  AuditAction,
  ActorKind,
  FlagLevel,
  FlagSource,
  ReportStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../events/outbox.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportsAntiAbuseService } from './reports-anti-abuse.service';
import { FlagPolicyService } from '../domain/flag-policy.service';
import { UserCacheService } from '../cache/user-cache.service';
import { lockUserRowForAggregateUpdate } from '../prisma/user-row-lock';
import { userToPublic } from '../users/user.mapper';

@Injectable()
export class ReportsService {
  private readonly log = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly anti: ReportsAntiAbuseService,
    private readonly policy: FlagPolicyService,
    private readonly userCache: UserCacheService,
  ) {}

  async create(dto: CreateReportDto) {
    const { dedupeKey } = await this.anti.assertCanReport({
      reporterDiscordId: dto.reporterDiscordId,
      targetDiscordId: dto.targetDiscordId,
      guildId: dto.guildId,
      reason: dto.reason,
      prismaDedupeLookup: (key, since) =>
        this.prisma.report.findFirst({
          where: { dedupeKey: key, createdAt: { gte: since } },
          select: { id: true },
        }),
    });

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const reported = await tx.user.upsert({
          where: { discordId: dto.targetDiscordId },
          create: {
            discordId: dto.targetDiscordId,
            flagScore: 0,
            flagLevel: FlagLevel.CLEAN,
          },
          update: {},
        });

        await tx.user.upsert({
          where: { discordId: dto.reporterDiscordId },
          create: {
            discordId: dto.reporterDiscordId,
            flagScore: 0,
            flagLevel: FlagLevel.CLEAN,
          },
          update: {},
        });

        await lockUserRowForAggregateUpdate(tx, reported.id);

        const report = await tx.report.create({
          data: {
            reporterDiscordId: dto.reporterDiscordId,
            reportedUserId: reported.id,
            guildId: dto.guildId ?? null,
            reason: dto.reason,
            dedupeKey,
            status: ReportStatus.PENDING,
          },
        });

        const weight = this.policy.communityReportWeight();

        const createdFlag = await tx.flag.create({
          data: {
            userId: reported.id,
            weight,
            effectiveWeight: weight,
            reason: dto.reason,
            source: FlagSource.COMMUNITY_REPORT,
            actorDiscordId: dto.reporterDiscordId,
            guildId: dto.guildId ?? null,
          },
        });

        await tx.user.update({
          where: { id: reported.id },
          data: { flagScore: { increment: weight } },
        });

        const afterScore = await tx.user.findUniqueOrThrow({
          where: { id: reported.id },
        });
        const nextLevel = this.policy.levelFromScore(afterScore.flagScore);

        const userAfter = await tx.user.update({
          where: { id: reported.id },
          data: {
            flagLevel: nextLevel,
            stateVersion: { increment: 1 },
          },
          include: { _count: { select: { flags: true } } },
        });

        await this.audit.logWithTx(tx, {
          action: AuditAction.REPORT_CREATED,
          entityType: 'report',
          entityId: report.id,
          targetId: dto.targetDiscordId,
          actorDiscordId: dto.reporterDiscordId,
          actorKind: ActorKind.USER,
          metadata: {
            guildId: dto.guildId,
            flagWeight: weight,
            flagLevel: userAfter.flagLevel,
          },
        });

        await this.outbox.enqueueMany(tx, [
          {
            type: 'user.reported',
            idempotencyKey: `user.reported:${report.id}`,
            payload: {
              reportId: report.id,
              targetDiscordId: dto.targetDiscordId,
              reporterDiscordId: dto.reporterDiscordId,
              guildId: dto.guildId ?? null,
            },
          },
          {
            type: 'user.updated',
            idempotencyKey: `user.updated:${reported.id}:report:${report.id}:flag:${createdFlag.id}`,
            payload: {
              discordId: dto.targetDiscordId,
              flagLevel: userAfter.flagLevel,
              flagScore: userAfter.flagScore,
              stateVersion: userAfter.stateVersion,
            },
          },
        ]);

        return { report, userAfter, weight };
      });

      const pub = userToPublic(result.userAfter, result.userAfter._count.flags);
      await this.userCache.setIfNewer(dto.targetDiscordId, pub);

      return {
        id: result.report.id,
        status: result.report.status,
        createdAt: result.report.createdAt,
        appliedFlagWeight: result.weight,
        targetFlagLevel: result.userAfter.flagLevel,
      };
    } catch (e) {
      this.log.warn(`Report transaction failed, rolling back rate limits: ${e}`);
      await this.anti.rollbackSlots(dto.reporterDiscordId, dto.guildId);
      throw e;
    }
  }
}
