import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuditAction, SupportTicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PlatformStatsService } from '../platform-stats/platform-stats.service';
import { TicketsService } from '../tickets/tickets.service';
import { UsersService } from '../users/users.service';
import type { RequestPrincipal } from '../auth/auth.types';

export type TicketBucketSummary = {
  open: number;
  pending: number;
  closed: number;
};

export type MeDashboardTicketPreview = {
  id: string;
  status: SupportTicketStatus;
  reportId: string;
  guildId: string | null;
  createdAt: string;
  updatedAt: string;
  targetDiscordId: string;
  reportStatus: string;
  reportReason: string;
};

export type MeDashboardReportPreview = {
  id: string;
  guildId: string | null;
  reason: string;
  status: string;
  createdAt: string;
  targetDiscordId: string;
};

export type ActivityItem = {
  id: string;
  timestamp: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  targetId: string | null;
  actorDiscordId: string | null;
};

export type SeriesPoint = {
  bucket: string;
  flagCreates: number;
  reportCreates: number;
  memberJoins: number;
};

function startOfUtcDay(d = new Date()): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function aggregateTicketStatuses(
  rows: { status: SupportTicketStatus; _count: number }[],
): TicketBucketSummary {
  const m = Object.fromEntries(rows.map((r) => [r.status, r._count])) as Record<
    string,
    number
  >;
  const n = (k: string) => m[k] ?? 0;
  return {
    open: n('OPEN') + n('NEEDS_EVIDENCE'),
    pending: n('EVIDENCE_SUBMITTED') + n('UNDER_REVIEW'),
    closed: n('RESOLVED') + n('REJECTED'),
  };
}

function mergeSparseSeries(
  flagRows: { bucket: Date; c: bigint }[],
  reportRows: { bucket: Date; c: bigint }[],
  memberRows: { bucket: Date; c: bigint }[],
): SeriesPoint[] {
  const keys = new Set<string>();
  const add = (rows: { bucket: Date; c: bigint }[]) => {
    for (const r of rows) {
      keys.add(r.bucket.toISOString());
    }
  };
  add(flagRows);
  add(reportRows);
  add(memberRows);
  const sorted = [...keys].sort();
  const fm = new Map(flagRows.map((r) => [r.bucket.toISOString(), Number(r.c)]));
  const rm = new Map(reportRows.map((r) => [r.bucket.toISOString(), Number(r.c)]));
  const jm = new Map(memberRows.map((r) => [r.bucket.toISOString(), Number(r.c)]));
  return sorted.map((bucket) => ({
    bucket,
    flagCreates: fm.get(bucket) ?? 0,
    reportCreates: rm.get(bucket) ?? 0,
    memberJoins: jm.get(bucket) ?? 0,
  }));
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly stats: PlatformStatsService,
    private readonly tickets: TicketsService,
    private readonly users: UsersService,
  ) {}

  async getMeDashboard(principal: RequestPrincipal) {
    if (principal.identity.kind !== 'user') {
      throw new ForbiddenException();
    }
    const discordId = principal.identity.discordId;
    const dayStart = startOfUtcDay();
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      platformSnapshot,
      ticketBuckets,
      ticketsPreview,
      reportsPreview,
      recentActivity,
      detectionsToday,
      detectionsLast24h,
    ] = await Promise.all([
      this.stats.getPublicSnapshot(),
      this.myTicketBuckets(discordId),
      this.myTicketsPreview(discordId),
      this.myReportsPreview(discordId),
      this.audit.list({ limit: 15 }),
      this.countFlagCreatesSince(dayStart),
      this.buildMergedSeries(last24h, 'hour'),
    ]);

    return {
      platformSnapshot,
      ticketBuckets,
      ticketsPreview,
      reportsPreview,
      recentActivity: recentActivity.items.map((r) => this.toActivity(r)),
      detectionsToday,
      detectionsLast24h,
    };
  }

  async getAdminDashboard() {
    const dayStart = startOfUtcDay();
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      platformSnapshot,
      adminTickets,
      reportsPending,
      recentActivity,
      detectionsToday,
      detectionsLast24h,
      flaggedPreview,
    ] = await Promise.all([
      this.stats.getPublicSnapshot(),
      this.tickets.adminList(),
      this.prisma.report.count({ where: { status: 'PENDING' } }),
      this.audit.list({ limit: 20 }),
      this.countFlagCreatesSince(dayStart),
      this.buildMergedSeries(last24h, 'hour'),
      this.users.listFlagged({ limit: 30 }),
    ]);

    return {
      platformSnapshot,
      ticketBuckets: adminTickets.ticketBuckets,
      tickets: { items: adminTickets.items },
      reportsPending,
      recentActivity: recentActivity.items.map((r) => this.toActivity(r)),
      detectionsToday,
      detectionsLast24h,
      flaggedPreview,
    };
  }

  async getAdminAnalytics(range: '24h' | '7d' | '30d') {
    const now = new Date();
    let start: Date;
    let trunc: 'hour' | 'day';
    if (range === '24h') {
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      trunc = 'hour';
    } else if (range === '7d') {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      trunc = 'day';
    } else {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      trunc = 'day';
    }
    const series = await this.buildMergedSeries(start, trunc);
    return { range, bucket: trunc, series };
  }

  private toActivity(r: {
    id: string;
    timestamp: Date;
    action: AuditAction;
    entityType: string;
    entityId: string;
    targetId: string | null;
    actorDiscordId: string | null;
  }): ActivityItem {
    return {
      id: r.id,
      timestamp: r.timestamp.toISOString(),
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      targetId: r.targetId,
      actorDiscordId: r.actorDiscordId,
    };
  }

  private async myTicketBuckets(discordId: string): Promise<TicketBucketSummary> {
    const rows = await this.prisma.supportTicket.groupBy({
      by: ['status'],
      where: { reporterDiscordId: discordId },
      _count: true,
    });
    return aggregateTicketStatuses(
      rows.map((r) => ({ status: r.status, _count: r._count })),
    );
  }

  private async myTicketsPreview(discordId: string): Promise<MeDashboardTicketPreview[]> {
    const rows = await this.prisma.supportTicket.findMany({
      where: { reporterDiscordId: discordId },
      orderBy: { updatedAt: 'desc' },
      take: 8,
      include: {
        report: {
          select: {
            id: true,
            status: true,
            reason: true,
            reportedUser: { select: { discordId: true } },
          },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      reportId: r.reportId,
      guildId: r.guildId,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      targetDiscordId: r.report.reportedUser.discordId,
      reportStatus: r.report.status,
      reportReason: r.report.reason,
    }));
  }

  private async myReportsPreview(discordId: string): Promise<MeDashboardReportPreview[]> {
    const rows = await this.prisma.report.findMany({
      where: { reporterDiscordId: discordId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: {
        reportedUser: { select: { discordId: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      guildId: r.guildId,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      targetDiscordId: r.reportedUser.discordId,
    }));
  }

  private async countFlagCreatesSince(since: Date): Promise<number> {
    return this.prisma.auditLog.count({
      where: {
        action: AuditAction.FLAG_CREATED,
        timestamp: { gte: since },
      },
    });
  }

  /** One round-trip for flag + report audit buckets (less DB load than two queries). */
  private async auditBucketsFlagAndReport(
    start: Date,
    trunc: 'hour' | 'day',
  ): Promise<{ bucket: Date; fc: bigint; rc: bigint }[]> {
    if (trunc === 'hour') {
      return this.prisma.$queryRaw<{ bucket: Date; fc: bigint; rc: bigint }[]>`
        SELECT date_trunc('hour', timestamp) AS bucket,
          count(*) FILTER (WHERE action = 'FLAG_CREATED'::"AuditAction")::bigint AS fc,
          count(*) FILTER (WHERE action = 'REPORT_CREATED'::"AuditAction")::bigint AS rc
        FROM audit_logs
        WHERE timestamp >= ${start}
          AND action IN ('FLAG_CREATED'::"AuditAction", 'REPORT_CREATED'::"AuditAction")
        GROUP BY 1 ORDER BY 1
      `;
    }
    return this.prisma.$queryRaw<{ bucket: Date; fc: bigint; rc: bigint }[]>`
      SELECT date_trunc('day', timestamp) AS bucket,
        count(*) FILTER (WHERE action = 'FLAG_CREATED'::"AuditAction")::bigint AS fc,
        count(*) FILTER (WHERE action = 'REPORT_CREATED'::"AuditAction")::bigint AS rc
      FROM audit_logs
      WHERE timestamp >= ${start}
        AND action IN ('FLAG_CREATED'::"AuditAction", 'REPORT_CREATED'::"AuditAction")
      GROUP BY 1 ORDER BY 1
    `;
  }

  private async memberFirstSeenBuckets(
    start: Date,
    trunc: 'hour' | 'day',
  ): Promise<{ bucket: Date; c: bigint }[]> {
    if (trunc === 'hour') {
      return this.prisma.$queryRaw<{ bucket: Date; c: bigint }[]>`
        SELECT date_trunc('hour', first_seen_at) AS bucket, count(*)::bigint AS c
        FROM guild_member_cache
        WHERE first_seen_at >= ${start}
        GROUP BY 1 ORDER BY 1
      `;
    }
    return this.prisma.$queryRaw<{ bucket: Date; c: bigint }[]>`
      SELECT date_trunc('day', first_seen_at) AS bucket, count(*)::bigint AS c
      FROM guild_member_cache
      WHERE first_seen_at >= ${start}
      GROUP BY 1 ORDER BY 1
    `;
  }

  private async buildMergedSeries(
    start: Date,
    trunc: 'hour' | 'day',
  ): Promise<SeriesPoint[]> {
    const [combined, memberRows] = await Promise.all([
      this.auditBucketsFlagAndReport(start, trunc),
      this.memberFirstSeenBuckets(start, trunc),
    ]);
    const flagRows = combined.map((r) => ({ bucket: r.bucket, c: r.fc }));
    const reportRows = combined.map((r) => ({ bucket: r.bucket, c: r.rc }));
    return mergeSparseSeries(flagRows, reportRows, memberRows);
  }
}
