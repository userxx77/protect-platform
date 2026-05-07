'use client';

import Link from 'next/link';
import {
  type ReportMemberDisplayDto,
  reportAvatarSrc,
  reportMemberLabel,
} from '@/lib/report-display';
import { approveReportAction, rejectReportAction } from './actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { flagActionLevels, flagLevelDisplayName, type FlagActionLevel } from '@protect/shared';
import { FlagLevelBadge } from '@/components/flag-level-badge';

export type PendingReportItem = {
  id: string;
  targetDiscordId: string;
  reporterDiscordId: string;
  reason: string;
  allegedFlagLevel?: string | null;
  createdAt: string;
  guildId: string | null;
  targetDisplay?: ReportMemberDisplayDto;
  reporterDisplay?: ReportMemberDisplayDto;
};

export function PendingReportsQueue({ items }: { items: PendingReportItem[] }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">Geen openstaande meldingen.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((r) => {
        const targetSrc = reportAvatarSrc(r.targetDisplay ?? null, r.targetDiscordId);
        const targetName = reportMemberLabel(r.targetDisplay ?? null, r.targetDiscordId);
        return (
          <li key={r.id}>
            <Card className="!p-0">
              <div className="flex gap-3 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={targetSrc}
                  alt=""
                  width={44}
                  height={44}
                  className="border-border h-11 w-11 shrink-0 rounded-full border"
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{targetName}</p>
                      <p className="text-muted-foreground font-mono text-[10px]">
                        {r.createdAt}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.allegedFlagLevel ? <FlagLevelBadge level={r.allegedFlagLevel} /> : null}
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/reports/${r.id}`}>Open</Link>
                      </Button>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Melder: {reportMemberLabel(r.reporterDisplay ?? null, r.reporterDiscordId)}
                  </p>
                  <p className="line-clamp-2 text-sm leading-snug">
                    {r.reason.length > 280 ? `${r.reason.slice(0, 277)}…` : r.reason}
                  </p>
                  <div className="border-border flex flex-wrap items-center gap-2 border-t pt-3">
                    <form action={rejectReportAction.bind(null, r.id)}>
                      <Button type="submit" variant="outline" size="sm">
                        Weigeren
                      </Button>
                    </form>
                    <span className="text-muted-foreground text-xs">Accepteren als:</span>
                    {flagActionLevels.map((level: FlagActionLevel) => (
                      <form key={level} action={approveReportAction.bind(null, r.id, level)}>
                        <Button type="submit" size="sm" variant="soft">
                          {flagLevelDisplayName(level)}
                        </Button>
                      </form>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
