import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  ActorKind,
  FlagLevel,
  FlagSource,
  ReportStatus,
} from '@prisma/client';
import { COMMUNITY_REPORT_REQUIRES_USER_ROLE_MESSAGE, parseAdminDiscordIds } from '@protect/shared';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../events/outbox.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportsAntiAbuseService } from './reports-anti-abuse.service';
import { FlagPolicyService } from '../domain/flag-policy.service';
import { UserCacheService } from '../cache/user-cache.service';
import { lockUserRowForAggregateUpdate } from '../prisma/user-row-lock';
import { userToPublic } from '../users/user.mapper';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AuthzService } from '../auth/authz.service';
import { AppRole, type RequestPrincipal } from '../auth/auth.types';
import { TicketsService } from '../tickets/tickets.service';

function truncateEventReason(reason: string, max = 200): string {
  const t = reason.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

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
    private readonly entitlements: EntitlementsService,
    private readonly authz: AuthzService,
    private readonly tickets: TicketsService,
    private readonly config: ConfigService,
  ) {}

  private async assertCommunityReporterEligible(reporterDiscordId: string): Promise<void> {
    const legacy = parseAdminDiscordIds(
      this.config.get<string>('ADMIN_DISCORD_IDS') ?? '',
    );
    if (legacy.includes(reporterDiscordId)) {
      return;
    }
    const trusted = await this.prisma.trustedUser.findUnique({
      where: { discordUserId: reporterDiscordId },
      select: { discordUserId: true },
    });
    if (trusted) {
      return;
    }
    const account = await this.prisma.platformAccount.findUnique({
      where: { discordUserId: reporterDiscordId },
      select: { role: true },
    });
    if (account?.role === 'USER' || account?.role === 'ADMIN') {
      return;
    }
    throw new ForbiddenException(COMMUNITY_REPORT_REQUIRES_USER_ROLE_MESSAGE);
  }

  private assertReporterAccess(dto: CreateReportDto, principal: RequestPrincipal): void {
    if (principal.identity.kind === 'user') {
      const isAdmin = this.authz.principalHasAnyRole(principal, [AppRole.ADMIN]);
      if (!isAdmin && principal.identity.discordId !== dto.reporterDiscordId) {
        throw new ForbiddenException('Cannot report on behalf of another user');
      }
    }
  }

  private async reporterInstantApplies(dto: CreateReportDto): Promise<boolean> {
    const reporterPrincipal = await this.authz.resolvePrincipal({
      kind: 'user',
      discordId: dto.reporterDiscordId,
    });
    return this.authz.principalHasAnyRole(reporterPrincipal, [
      AppRole.TRUSTED,
      AppRole.ADMIN,
    ]);
  }

  async create(dto: CreateReportDto, principal: RequestPrincipal) {
    this.assertReporterAccess(dto, principal);

    const guildId = dto.guildId?.trim();
    const isCommunityInGuild = !!guildId;

    if (isCommunityInGuild) {
      await this.assertCommunityReporterEligible(dto.reporterDiscordId);
      const licensed = await this.entitlements.isGuildLicensed(guildId);
      if (!licensed) {
        throw new ForbiddenException('This server has no active Sentra license for reports');
      }
      return this.createPendingReport({ ...dto, guildId });
    }

    const instant = await this.reporterInstantApplies(dto);
    if (!instant) {
      await this.assertCommunityReporterEligible(dto.reporterDiscordId);
      throw new BadRequestException('guildId is required for community reports');
    }

    return this.createInstantReport(dto);
  }

  /** Community path: PENDING review, no flag until admin approves. */
  private async createPendingReport(dto: CreateReportDto) {
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

        await this.audit.logWithTx(tx, {
          action: AuditAction.REPORT_CREATED,
          entityType: 'report',
          entityId: report.id,
          targetId: dto.targetDiscordId,
          actorDiscordId: dto.reporterDiscordId,
          actorKind: ActorKind.USER,
          metadata: {
            guildId: dto.guildId,
            pendingReview: true,
          },
        });

        await this.outbox.enqueue(tx, {
          type: 'report.pending',
          idempotencyKey: `report.pending:${report.id}`,
          payload: {
            reportId: report.id,
            targetDiscordId: dto.targetDiscordId,
            reporterDiscordId: dto.reporterDiscordId,
            guildId: dto.guildId ?? null,
            reason: truncateEventReason(dto.reason),
          },
        });

        await this.tickets.createForPendingReport(tx, {
          reportId: report.id,
          guildId: dto.guildId ?? null,
          reporterDiscordId: dto.reporterDiscordId,
        });

        return { report };
      });

      return {
        id: result.report.id,
        status: result.report.status,
        createdAt: result.report.createdAt,
        pendingReview: true as const,
      };
    } catch (e) {
      this.log.warn(`Pending report failed: ${e}`);
      await this.anti.rollbackSlots(dto.reporterDiscordId, dto.guildId);
      throw e;
    }
  }

  /** Trusted/admin path: flag applied immediately. */
  private async createInstantReport(dto: CreateReportDto) {
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
            status: ReportStatus.ACCEPTED,
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

        await tx.report.update({
          where: { id: report.id },
          data: { flagId: createdFlag.id },
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
            instant: true,
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
              reason: truncateEventReason(dto.reason),
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
        pendingReview: false as const,
      };
    } catch (e) {
      this.log.warn(`Report transaction failed, rolling back rate limits: ${e}`);
      await this.anti.rollbackSlots(dto.reporterDiscordId, dto.guildId);
      throw e;
    }
  }

  async listPending(params: { limit: number }) {
    const take = Math.min(Math.max(params.limit, 1), 100);
    const rows = await this.prisma.report.findMany({
      where: { status: ReportStatus.PENDING },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        reportedUser: { select: { discordId: true } },
        supportTicket: { select: { id: true, status: true } },
      },
    });

    return {
      items: rows.map((r) => ({
        id: r.id,
        reporterDiscordId: r.reporterDiscordId,
        targetDiscordId: r.reportedUser.discordId,
        guildId: r.guildId,
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        ticketId: r.supportTicket?.id ?? null,
        ticketStatus: r.supportTicket?.status ?? null,
      })),
    };
  }

  async approve(reportId: string, adminDiscordId: string) {
    const existing = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: { reportedUser: true },
    });
    if (!existing) throw new NotFoundException('Report not found');
    if (existing.status !== ReportStatus.PENDING) {
      throw new BadRequestException('Report is not pending');
    }
    if (existing.flagId) {
      throw new BadRequestException('Report already has a flag');
    }

    const dto = {
      targetDiscordId: existing.reportedUser.discordId,
      reporterDiscordId: existing.reporterDiscordId,
      guildId: existing.guildId ?? undefined,
      reason: existing.reason,
    };

    const result = await this.prisma.$transaction(async (tx) => {
      await lockUserRowForAggregateUpdate(tx, existing.reportedUserId);

      const weight = this.policy.communityReportWeight();

      const createdFlag = await tx.flag.create({
        data: {
          userId: existing.reportedUserId,
          weight,
          effectiveWeight: weight,
          reason: existing.reason,
          source: FlagSource.COMMUNITY_REPORT,
          actorDiscordId: existing.reporterDiscordId,
          guildId: existing.guildId ?? null,
        },
      });

      await tx.user.update({
        where: { id: existing.reportedUserId },
        data: { flagScore: { increment: weight } },
      });

      const afterScore = await tx.user.findUniqueOrThrow({
        where: { id: existing.reportedUserId },
      });
      const nextLevel = this.policy.levelFromScore(afterScore.flagScore);

      const userAfter = await tx.user.update({
        where: { id: existing.reportedUserId },
        data: {
          flagLevel: nextLevel,
          stateVersion: { increment: 1 },
        },
        include: { _count: { select: { flags: true } } },
      });

      const report = await tx.report.update({
        where: { id: reportId },
        data: {
          status: ReportStatus.ACCEPTED,
          flagId: createdFlag.id,
          reviewedByDiscordId: adminDiscordId,
          reviewedAt: new Date(),
        },
      });

      await this.audit.logWithTx(tx, {
        action: AuditAction.REPORT_APPROVED,
        entityType: 'report',
        entityId: report.id,
        targetId: dto.targetDiscordId,
        actorDiscordId: adminDiscordId,
        actorKind: ActorKind.USER,
        metadata: { flagId: createdFlag.id, guildId: existing.guildId },
      });

      await this.outbox.enqueueMany(tx, [
        {
          type: 'user.reported',
          idempotencyKey: `user.reported:${report.id}:approved`,
          payload: {
            reportId: report.id,
            targetDiscordId: dto.targetDiscordId,
            reporterDiscordId: dto.reporterDiscordId,
            guildId: existing.guildId ?? null,
            reason: truncateEventReason(existing.reason),
          },
        },
        {
          type: 'user.updated',
          idempotencyKey: `user.updated:${existing.reportedUserId}:approve:${report.id}:flag:${createdFlag.id}`,
          payload: {
            discordId: dto.targetDiscordId,
            flagLevel: userAfter.flagLevel,
            flagScore: userAfter.flagScore,
            stateVersion: userAfter.stateVersion,
          },
        },
      ]);

      await this.tickets.finalizeTicketForReport(
        tx,
        reportId,
        'RESOLVED',
        adminDiscordId,
      );

      return { report, userAfter, weight };
    });

    const pub = userToPublic(result.userAfter, result.userAfter._count.flags);
    await this.userCache.setIfNewer(dto.targetDiscordId, pub);

    return {
      id: result.report.id,
      status: result.report.status,
      appliedFlagWeight: result.weight,
      targetFlagLevel: result.userAfter.flagLevel,
    };
  }

  async reject(reportId: string, adminDiscordId: string, resolverNote?: string) {
    const existing = await this.prisma.report.findUnique({
      where: { id: reportId },
    });
    if (!existing) throw new NotFoundException('Report not found');
    if (existing.status !== ReportStatus.PENDING) {
      throw new BadRequestException('Report is not pending');
    }

    const report = await this.prisma.$transaction(async (tx) => {
      const r = await tx.report.update({
        where: { id: reportId },
        data: {
          status: ReportStatus.REJECTED,
          reviewedByDiscordId: adminDiscordId,
          reviewedAt: new Date(),
          resolvedAt: new Date(),
          resolverNote: resolverNote ?? null,
        },
      });

      await this.audit.logWithTx(tx, {
        action: AuditAction.REPORT_REJECTED,
        entityType: 'report',
        entityId: r.id,
        targetId: existing.reporterDiscordId,
        actorDiscordId: adminDiscordId,
        actorKind: ActorKind.USER,
        metadata: { guildId: existing.guildId },
      });

      await this.tickets.finalizeTicketForReport(
        tx,
        reportId,
        'REJECTED',
        adminDiscordId,
      );

      return r;
    });

    return {
      id: report.id,
      status: report.status,
    };
  }
}
