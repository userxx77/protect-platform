import Link from 'next/link';
import { notFound } from 'next/navigation';
import { dashboardApi } from '@/lib/api-server';
import { FlagLevelBadge } from '@/components/flag-level-badge';
import { ReportModerationPanel, ReportPersonCard } from './report-detail-client';
import type { ReportMemberDisplayDto } from '@/lib/report-display';

type ReportDetailResponse = {
  id: string;
  status: string;
  reporterDiscordId: string;
  targetDiscordId: string;
  guildId: string | null;
  reason: string;
  allegedFlagLevel: string | null;
  createdAt: string;
  reviewedAt: string | null;
  resolverNote: string | null;
  ticketId: string | null;
  ticketStatus: string | null;
  canModerate: boolean;
  targetDisplay: ReportMemberDisplayDto;
  reporterDisplay: ReportMemberDisplayDto;
};

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data: ReportDetailResponse;
  try {
    data = await dashboardApi<ReportDetailResponse>(`/reports/${id}`);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/dashboard/reports"
          className="text-muted-foreground hover:text-primary text-sm"
        >
          ← Back to my reports
        </Link>
        {data.canModerate ? (
          <>
            {' · '}
            <Link
              href="/dashboard/admin/reports"
              className="text-muted-foreground hover:text-primary text-sm"
            >
              Reports queue
            </Link>
          </>
        ) : null}
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Report</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Submitted {new Date(data.createdAt).toLocaleString()}
          {data.guildId ? ` · server ${data.guildId}` : ''}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-sm">Status:</span>
        <span className="text-sm font-medium">{data.status}</span>
        {data.allegedFlagLevel ? (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground text-sm">Reporter suggestion:</span>
            <FlagLevelBadge level={data.allegedFlagLevel} />
          </>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ReportPersonCard title="Subject" discordId={data.targetDiscordId} display={data.targetDisplay} />
        <ReportPersonCard title="Reporter" discordId={data.reporterDiscordId} display={data.reporterDisplay} />
      </div>

      <section className="border-border rounded-xl border bg-card/40 p-5">
        <h2 className="text-sm font-semibold">Reason</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{data.reason}</p>
      </section>

      {data.reviewedAt ? (
        <p className="text-muted-foreground text-sm">
          Reviewed: {new Date(data.reviewedAt).toLocaleString()}
        </p>
      ) : null}
      {data.resolverNote ? (
        <p className="text-muted-foreground text-sm">Note: {data.resolverNote}</p>
      ) : null}
      {data.ticketId ? (
        <p className="text-muted-foreground text-xs">
          Ticket: {data.ticketStatus ?? '—'} ({data.ticketId.slice(0, 8)}…)
        </p>
      ) : null}

      <ReportModerationPanel reportId={data.id} canModerate={data.canModerate} />
    </div>
  );
}
