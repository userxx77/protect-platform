'use client';

import { useState, useTransition } from 'react';
import { approveReportAction, rejectReportAction } from '@/app/dashboard/admin/reports/actions';
import { flagActionLevels, flagLevelDisplayName, type FlagActionLevel } from '@protect/shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ReportModerationActions({ reportId }: { reportId: string }) {
  const [severity, setSeverity] = useState<FlagActionLevel>(flagActionLevels[0]);
  const [pending, startTransition] = useTransition();

  return (
    <div className={cn('flex flex-wrap items-center gap-2')}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        className="border-destructive/40 text-destructive hover:bg-destructive/10"
        onClick={() => startTransition(() => void rejectReportAction(reportId))}
      >
        Reject
      </Button>
      <label className="text-muted-foreground flex items-center gap-2 text-xs">
        <span>Approve as</span>
        <select
          className="border-border bg-surface h-8 max-w-[11rem] rounded-md border px-2 text-xs"
          value={severity}
          disabled={pending}
          onChange={(e) => setSeverity(e.target.value as FlagActionLevel)}
        >
          {flagActionLevels.map((level) => (
            <option key={level} value={level}>
              {flagLevelDisplayName(level)}
            </option>
          ))}
        </select>
      </label>
      <Button
        type="button"
        size="sm"
        variant="default"
        disabled={pending}
        onClick={() => startTransition(() => void approveReportAction(reportId, severity))}
      >
        Approve
      </Button>
    </div>
  );
}
