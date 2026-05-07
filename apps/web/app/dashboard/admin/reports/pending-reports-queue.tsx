'use client';

import { flagActionLevels, flagLevelDisplayName, type FlagActionLevel } from '@protect/shared';
import { approveReportAction, rejectReportAction } from './actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export type PendingReportItem = {
  id: string;
  targetDiscordId: string;
  reporterDiscordId: string;
  reason: string;
  allegedFlagLevel?: string | null;
  createdAt: string;
  guildId: string | null;
};

export function PendingReportsQueue({ items }: { items: PendingReportItem[] }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">No pending reports.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((r) => (
        <li key={r.id}>
          <Card className="!p-0">
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-muted-foreground font-mono text-xs">{r.createdAt}</span>
                <span className="font-mono text-xs">{r.guildId ?? '—'}</span>
              </div>
              <p className="text-sm">
                <span className="text-muted-foreground">Target</span>{' '}
                <span className="font-mono">{r.targetDiscordId}</span>
                {' · '}
                <span className="text-muted-foreground">From</span>{' '}
                <span className="font-mono">{r.reporterDiscordId}</span>
              </p>
              <p className="text-sm leading-snug">
                {r.reason.length > 400 ? `${r.reason.slice(0, 397)}…` : r.reason}
              </p>
              {r.allegedFlagLevel ? (
                <p className="text-muted-foreground text-xs">
                  Reporter suggested: {flagLevelDisplayName(r.allegedFlagLevel)}
                </p>
              ) : null}
              <div className="border-border flex flex-wrap items-center gap-2 border-t pt-3">
                <form action={rejectReportAction.bind(null, r.id)}>
                  <Button type="submit" variant="outline" size="sm">
                    Deny
                  </Button>
                </form>
                <span className="text-muted-foreground text-xs">Accept as:</span>
                {flagActionLevels.map((level: FlagActionLevel) => (
                  <form key={level} action={approveReportAction.bind(null, r.id, level)}>
                    <Button type="submit" size="sm" variant="soft">
                      {flagLevelDisplayName(level)}
                    </Button>
                  </form>
                ))}
              </div>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
