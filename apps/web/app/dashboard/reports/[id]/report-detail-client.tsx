'use client';

import {
  type ReportMemberDisplayDto,
  reportAvatarSrc,
  reportMemberHandle,
  reportMemberLabel,
} from '@/lib/report-display';
import { approveReportAction, rejectReportAction } from '@/app/dashboard/admin/reports/actions';
import { flagActionLevels, flagLevelDisplayName, type FlagActionLevel } from '@protect/shared';
import { Button } from '@/components/ui/button';

export function ReportModerationPanel({
  reportId,
  canModerate,
}: {
  reportId: string;
  canModerate: boolean;
}) {
  if (!canModerate) return null;
  return (
    <div className="border-border space-y-3 rounded-xl border bg-surface/30 p-4">
      <p className="text-sm font-medium">Beoordeling (platform admin)</p>
      <p className="text-muted-foreground text-xs">
        Weiger de melding of kies de reputatietier die je wilt toepassen.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <form action={rejectReportAction.bind(null, reportId)}>
          <Button type="submit" variant="outline" size="sm">
            Weigeren
          </Button>
        </form>
        <span className="text-muted-foreground text-xs">Accepteren als:</span>
        {flagActionLevels.map((level: FlagActionLevel) => (
          <form key={level} action={approveReportAction.bind(null, reportId, level)}>
            <Button type="submit" size="sm" variant="soft">
              {flagLevelDisplayName(level)}
            </Button>
          </form>
        ))}
      </div>
    </div>
  );
}

export function ReportPersonCard({
  title,
  discordId,
  display,
}: {
  title: string;
  discordId: string;
  display: ReportMemberDisplayDto;
}) {
  const src = reportAvatarSrc(display, discordId);
  const handle = reportMemberHandle(display);
  return (
    <div className="border-border bg-surface/25 flex gap-3 rounded-xl border p-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- Discord CDN */}
      <img src={src} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-full" />
      <div className="min-w-0">
        <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
          {title}
        </p>
        <p className="truncate text-sm font-semibold">{reportMemberLabel(display, discordId)}</p>
        {handle ? <p className="text-muted-foreground truncate text-xs">{handle}</p> : null}
        <p className="text-muted-foreground font-mono text-[10px]">{discordId}</p>
      </div>
    </div>
  );
}
